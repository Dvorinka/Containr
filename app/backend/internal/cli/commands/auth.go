package commands

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"golang.org/x/term"
)

// AuthCmd groups authentication commands.
var AuthCmd = &cobra.Command{
	Use:   "auth",
	Short: "Authenticate with a Containr instance",
	Long: `Login with a personal access token (cnp_...) created under
Settings → Personal Access Tokens, check status, or switch profiles.`,
}

var loginCmd = &cobra.Command{
	Use:   "login [token]",
	Short: "Store a personal access token",
	Long: `Login with a cnp_ token. Reads interactively when no argument is
given. The token is verified against the API before it is stored.`,
	Args: cobra.MaximumNArgs(1),
	RunE: runLogin,
}

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Remove the stored token",
	RunE:  runLogout,
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show the active profile and verify the token",
	RunE:  runStatus,
}

func init() {
	loginCmd.Flags().String("url", "", "API URL to store in the profile (e.g. https://containr.example.com)")
	loginCmd.Flags().String("name", "", "profile name to save under (default: active profile)")
	AuthCmd.AddCommand(loginCmd, logoutCmd, statusCmd)
}

type profileResponse struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	IsAdmin bool   `json:"is_admin"`
}

func runLogin(cmd *cobra.Command, args []string) error {
	var token string
	if len(args) > 0 {
		token = args[0]
	} else if isTerminal() {
		fmt.Fprint(os.Stderr, "Token: ")
		raw, err := term.ReadPassword(int(os.Stdin.Fd()))
		fmt.Fprintln(os.Stderr)
		if err != nil {
			return err
		}
		token = string(raw)
	}
	if token == "" {
		return &APIError{Message: "token is required — pass it as an argument or pipe it via stdin", ExitCode: ExitValidation}
	}

	// Verify before saving so a mistyped token fails loudly.
	urlFlag, _ := cmd.Flags().GetString("url")
	probe := &Client{BaseURL: ResolveAPIURL(), Token: token}
	if urlFlag != "" {
		probe.BaseURL = normalizeBase(urlFlag)
	}
	var profile profileResponse
	if err := probe.DoJSON("GET", "/user/profile", nil, &profile); err != nil {
		return fmt.Errorf("token verification failed: %w", err)
	}

	name, _ := cmd.Flags().GetString("name")
	if name == "" {
		name = ActiveProfile()
	}
	if err := SaveProfile(name, probe.BaseURL, token); err != nil {
		return fmt.Errorf("failed to save profile: %w", err)
	}

	if JSONMode() {
		return PrintJSON(map[string]interface{}{
			"profile": name, "api_url": probe.BaseURL,
			"user": profile,
		})
	}
	fmt.Printf("Logged in as %s (%s) — profile %q → %s\n", profile.Name, profile.Email, name, probe.BaseURL)
	return nil
}

func runLogout(cmd *cobra.Command, args []string) error {
	name := ActiveProfile()
	if err := ClearProfileToken(name); err != nil {
		return fmt.Errorf("failed to update config: %w", err)
	}
	if !JSONMode() {
		fmt.Printf("Removed token from profile %q\n", name)
	} else {
		return PrintJSON(map[string]string{"status": "ok", "profile": name})
	}
	return nil
}

func runStatus(cmd *cobra.Command, args []string) error {
	client := NewClient()
	profile := ActiveProfile()

	if JSONMode() {
		out := map[string]interface{}{
			"profile": profile,
			"api_url": client.BaseURL,
		}
		if client.Token != "" {
			var p profileResponse
			if err := client.DoJSON("GET", "/user/profile", nil, &p); err == nil {
				out["user"] = p
				out["authenticated"] = true
			} else {
				out["authenticated"] = false
			}
		} else {
			out["authenticated"] = false
		}
		return PrintJSON(out)
	}

	fmt.Printf("Profile:  %s\n", profile)
	fmt.Printf("API URL:  %s\n", client.BaseURL)
	if client.Token == "" {
		fmt.Println("Token:    not set — run `containr auth login <token>`")
		return nil
	}
	var p profileResponse
	if err := client.DoJSON("GET", "/user/profile", nil, &p); err != nil {
		fmt.Printf("Token:    present but rejected (%v)\n", err)
		return nil
	}
	fmt.Printf("Identity: %s <%s>\n", p.Name, p.Email)
	if p.IsAdmin {
		fmt.Println("Role:     platform admin")
	}

	var bannersResp struct {
		Banners []struct {
			Title string `json:"title"`
			Body  string `json:"body"`
			Level string `json:"level"`
		} `json:"banners"`
	}
	if err := client.DoJSON("GET", "/banners/active", nil, &bannersResp); err == nil {
		for _, b := range bannersResp.Banners {
			fmt.Printf("[%s] %s\n", b.Level, b.Title)
			if b.Body != "" {
				fmt.Printf("      %s\n", b.Body)
			}
		}
	}
	return nil
}
