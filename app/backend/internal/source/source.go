// Package source materializes git checkouts for builds. Services reference
// a repository by URL (or owner/repo); deployments fetch the exact branch or
// commit into an isolated workdir, then point the builders at build_path
// inside it. Credentials travel through GIT_ASKPASS so tokens never land in
// argv, .git/config, logs, or the build context.
package source

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Spec describes one checkout.
type Spec struct {
	CloneURL  string // https URL (NormalizeCloneURL output); local paths allowed for tests
	Branch    string // ref to fetch when Commit is empty
	Commit    string // optional SHA pinned over Branch
	BuildPath string // subdirectory inside the repo; "" or "." = repo root
	Token     string // optional http credential
	User      string // credential username; defaults per provider in ResolveUser
}

// NormalizeCloneURL converts the forms services store into an https clone
// URL: ssh remotes (git@host:org/repo, ssh://git@host/org/repo) map onto
// https so token auth works uniformly. A bare "owner/repo" is returned
// unchanged — the caller resolves the host through git_repositories.
func NormalizeCloneURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("empty repository reference")
	}
	// scp-style ssh remote: git@github.com:org/repo(.git)
	if strings.HasPrefix(raw, "git@") && strings.Contains(raw, ":") {
		host := raw[len("git@"):strings.Index(raw, ":")]
		path := strings.TrimPrefix(raw[strings.Index(raw, ":")+1:], "/")
		return "https://" + host + "/" + path, nil
	}
	if strings.HasPrefix(raw, "ssh://") {
		u, err := url.Parse(raw)
		if err != nil {
			return "", fmt.Errorf("invalid ssh remote %q", raw)
		}
		return "https://" + u.Host + u.Path, nil
	}
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return raw, nil
	}
	if strings.Contains(raw, "://") {
		return "", fmt.Errorf("unsupported repository scheme in %q", raw)
	}
	if strings.Count(raw, "/") == 1 && !strings.ContainsAny(raw, " @:") {
		return raw, nil // owner/repo — resolved against git_repositories upstream
	}
	return "", fmt.Errorf("unsupported repository reference %q", raw)
}

// ValidateRemoteURL rejects non-http(s) clones before a deploy accepts them.
// Local checkouts (tests, mounted workspaces) bypass this via Checkout.
func ValidateRemoteURL(cloneURL string) error {
	if strings.HasPrefix(cloneURL, "http://") || strings.HasPrefix(cloneURL, "https://") {
		return nil
	}
	return fmt.Errorf("clone URL must be http(s), got %q", cloneURL)
}

// Checkout fetches spec into destDir/repo and returns the directory the
// builders should consume (checkout root + build_path). Callers
// RemoveAll(destDir) — the checkout is a per-deployment workspace, never
// shared. The askpass helper lives outside repo so it can't leak into the
// build context.
func Checkout(ctx context.Context, destDir string, spec Spec) (string, error) {
	repoDir := filepath.Join(destDir, "repo")
	if err := os.MkdirAll(repoDir, 0o755); err != nil {
		return "", err
	}

	env := append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	if spec.Token != "" {
		// Askpass keeps the token out of argv and .git/config.
		askpass := filepath.Join(destDir, ".git-askpass")
		script := "#!/bin/sh\ncase \"$1\" in\n*sername*) printf '%s' \"$CONTAINR_GIT_USER\" ;;\n*) printf '%s' \"$CONTAINR_GIT_TOKEN\" ;;\nesac\n"
		if err := os.WriteFile(askpass, []byte(script), 0o700); err != nil {
			return "", fmt.Errorf("write askpass: %w", err)
		}
		user := spec.User
		if user == "" {
			user = "x-access-token"
		}
		env = append(env,
			"GIT_ASKPASS="+askpass,
			"CONTAINR_GIT_USER="+user,
			"CONTAINR_GIT_TOKEN="+spec.Token,
		)
	}

	run := func(args ...string) error {
		cmd := exec.CommandContext(ctx, "git", args...)
		cmd.Dir = repoDir
		cmd.Env = env
		out, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("git %s: %s", args[0], strings.TrimSpace(string(out)))
		}
		return nil
	}

	if err := run("init", "-q"); err != nil {
		return "", err
	}
	if err := run("remote", "add", "origin", spec.CloneURL); err != nil {
		return "", err
	}

	ref := spec.Commit
	if ref == "" {
		ref = spec.Branch
	}
	if ref == "" {
		ref = "HEAD"
	}
	// Cheap path first, widening on failure: dumb transports reject
	// --depth outright, and some hosts refuse direct SHA fetches so a
	// pinned commit may only be reachable through its branch.
	attempts := [][]string{
		{"fetch", "--depth", "1", "origin", ref},
		{"fetch", "origin", ref},
	}
	if spec.Commit != "" {
		branchRef := spec.Branch
		if branchRef == "" {
			branchRef = "HEAD"
		}
		attempts = append(attempts,
			[]string{"fetch", "--depth", "100", "origin", branchRef},
			[]string{"fetch", "origin", branchRef},
		)
	}
	var fetchErr error
	for _, args := range attempts {
		if fetchErr = run(args...); fetchErr == nil {
			break
		}
	}
	if fetchErr != nil {
		return "", fetchErr
	}
	if err := run("checkout", "-q", spec.CommitOrFetchHead()); err != nil {
		return "", err
	}

	return ResolveBuildPath(repoDir, spec.BuildPath)
}

// CommitOrFetchHead is the checkout target: the pinned commit or FETCH_HEAD.
func (s Spec) CommitOrFetchHead() string {
	if s.Commit != "" {
		return s.Commit
	}
	return "FETCH_HEAD"
}

// ResolveBuildPath maps build_path onto the checkout and rejects escapes —
// a path like ../../etc must never leave the workspace.
func ResolveBuildPath(checkoutDir, buildPath string) (string, error) {
	bp := strings.TrimSpace(buildPath)
	if bp == "" || bp == "." {
		return checkoutDir, nil
	}
	if filepath.IsAbs(bp) {
		return "", fmt.Errorf("build_path must be relative, got %q", bp)
	}
	clean := filepath.Clean(bp)
	if clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("build_path escapes the checkout: %q", bp)
	}
	resolved := filepath.Join(checkoutDir, clean)
	info, err := os.Stat(resolved)
	if err != nil {
		return "", fmt.Errorf("build_path %q not found in checkout", bp)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("build_path %q is not a directory", bp)
	}
	return resolved, nil
}
