package commands

// SSH node bootstrap — one SSH session installs the agent (binary +
// systemd + enroll token), then SSH is never needed again. SSH keys
// stay client-side; the server only sees the resulting agent.

import (
	"errors"
	"fmt"
	"net"
	"os"
	"os/user"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
	"golang.org/x/term"
)

var (
	nodeSSHKey   string
	nodeSSHName  string
	nodeSSHPrint bool
)

var nodesAddCmd = &cobra.Command{
	Use:   "add <[user@]host[:port]>",
	Short: "Bootstrap a node agent over SSH (one session, then closed)",
	Long: `Installs the containr agent on a remote host:

  1. mints a single-use enroll token via the API
  2. SSHes in (agent socket, --key, or default key files)
  3. runs the instance's install script remotely
  4. closes the session — the agent heartbeats outbound from then on

Use --print to skip SSH and emit the remote one-liner for manual runs.`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}

		// Mint the enroll token first — SSH failures then don't leave
		// partial state on the remote.
		body := map[string]interface{}{"label": "bootstrap"}
		if nodeSSHName != "" {
			body["label"] = "bootstrap:" + nodeSSHName
		}
		tokenData, err := c.Do("POST", "/agent-tokens", body)
		if err != nil {
			return err
		}
		tokenObj, err := unwrapObject(tokenData, "token")
		if err != nil {
			return err
		}
		token := str(tokenObj, "token")
		if token == "" {
			return &APIError{Message: "enroll token missing from response", ExitCode: ExitError}
		}

		// Agent bootstrap endpoints live at /api/agents (no /v1) — strip
		// the API version suffix off the client base.
		apiRoot := strings.TrimSuffix(c.BaseURL, "/api/v1")
		installCmd := fmt.Sprintf(
			`curl -fsSL %q | bash -s -- --url %q --token %q --name %q`,
			apiRoot+"/api/agents/install.sh", apiRoot, token, firstNonEmptyStr(nodeSSHName, nodeSSHTarget(args[0]).host),
		)

		if nodeSSHPrint {
			fmt.Println(installCmd)
			return nil
		}

		target := nodeSSHTarget(args[0])
		if err := sshBootstrap(target, installCmd); err != nil {
			return err
		}
		fmt.Printf("agent installing on %s — it should appear in `containr nodes list` within ~15s\n", target.host)
		return nil
	},
}

type sshTarget struct {
	user string
	host string
	port string
}

func nodeSSHTarget(raw string) sshTarget {
	t := sshTarget{port: "22"}
	rest := raw
	if at := strings.LastIndex(rest, "@"); at >= 0 {
		t.user = rest[:at]
		rest = rest[at+1:]
	}
	if colon := strings.LastIndex(rest, ":"); colon >= 0 && !strings.Contains(rest, "]") {
		t.host, t.port = rest[:colon], rest[colon+1:]
	} else {
		t.host = rest
	}
	if t.user == "" {
		if u, err := user.Current(); err == nil {
			t.user = u.Username
		}
	}
	return t
}

func sshAuthMethods(keyPath string) []ssh.AuthMethod {
	var methods []ssh.AuthMethod

	// ssh-agent first — matches how people actually manage keys.
	if sock := os.Getenv("SSH_AUTH_SOCK"); sock != "" {
		if conn, err := net.Dial("unix", sock); err == nil {
			defer conn.Close()
			methods = append(methods, ssh.PublicKeysCallback(agent.NewClient(conn).Signers))
		}
	}

	var keyFiles []string
	if keyPath != "" {
		keyFiles = []string{keyPath}
	} else if home, err := os.UserHomeDir(); err == nil {
		for _, name := range []string{"id_ed25519", "id_rsa", "id_ecdsa"} {
			p := filepath.Join(home, ".ssh", name)
			if _, err := os.Stat(p); err == nil {
				keyFiles = append(keyFiles, p)
			}
		}
	}
	for _, p := range keyFiles {
		if signer, err := sshPrivateKey(p); err == nil {
			methods = append(methods, ssh.PublicKeys(signer))
		}
	}
	return methods
}

func sshPrivateKey(path string) (ssh.Signer, error) {
	pem, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	signer, err := ssh.ParsePrivateKey(pem)
	if err != nil {
		var missing *ssh.PassphraseMissingError
		if errors.As(err, &missing) {
			fmt.Fprintf(os.Stderr, "passphrase for %s: ", path)
			pass, readErr := term.ReadPassword(int(os.Stdin.Fd()))
			fmt.Fprintln(os.Stderr)
			if readErr != nil {
				return nil, readErr
			}
			return ssh.ParsePrivateKeyWithPassphrase(pem, pass)
		}
		return nil, err
	}
	return signer, nil
}

func sshBootstrap(t sshTarget, remoteCmd string) error {
	config := &ssh.ClientConfig{
		User:            t.user,
		Auth:            sshAuthMethods(nodeSSHKey),
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // jarvis: TOFU would be better; ssh_known_hosts parsing is the upgrade path
		Timeout:         15 * time.Second,
	}
	if len(config.Auth) == 0 {
		return &APIError{Message: "no SSH auth methods (ssh-agent empty, no usable keys)", ExitCode: ExitError}
	}

	conn, err := ssh.Dial("tcp", net.JoinHostPort(t.host, t.port), config)
	if err != nil {
		return &APIError{Message: fmt.Sprintf("ssh connect: %v", err), ExitCode: ExitError}
	}
	defer conn.Close()

	session, err := conn.NewSession()
	if err != nil {
		return err
	}
	defer session.Close()
	session.Stdout = os.Stdout
	session.Stderr = os.Stderr

	// Root shells run directly; otherwise escalate via sudo. NOPASSWD
	// sudo is assumed — a password prompt here means the operator should
	// use --print and run the command themselves.
	if t.user == "root" {
		return session.Run(remoteCmd)
	}
	return session.Run("sudo -n " + remoteCmd)
}

func firstNonEmptyStr(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func init() {
	nodesAddCmd.Flags().StringVar(&nodeSSHKey, "key", "", "SSH private key path (defaults: agent, ~/.ssh/id_*)")
	nodesAddCmd.Flags().StringVar(&nodeSSHName, "name", "", "node display name (defaults to remote hostname)")
	nodesAddCmd.Flags().BoolVar(&nodeSSHPrint, "print", false, "print the remote install command instead of running SSH")
	NodesCmd.AddCommand(nodesAddCmd)
}
