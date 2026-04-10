package commands

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// AuthCmd represents the auth command
var AuthCmd = &cobra.Command{
	Use:   "auth",
	Short: "Authenticate with Containr API",
	Long: `Manage authentication with the Containr API.
You can login, logout, and check your current authentication status.`,
}

// loginCmd represents the login command
var loginCmd = &cobra.Command{
	Use:   "login [token]",
	Short: "Login to Containr",
	Long: `Login to Containr using your API token.
You can get your token from the Containr web interface.`,
	Args: cobra.MaximumNArgs(1),
	RunE: runLogin,
}

// logoutCmd represents the logout command
var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Logout from Containr",
	Long:  `Remove stored authentication credentials.`,
	RunE:  runLogout,
}

// statusCmd represents the status command
var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Check authentication status",
	Long:  `Check if you are currently authenticated with Containr.`,
	RunE:  runStatus,
}

func init() {
	AuthCmd.AddCommand(loginCmd)
	AuthCmd.AddCommand(logoutCmd)
	AuthCmd.AddCommand(statusCmd)
}

func runLogin(cmd *cobra.Command, args []string) error {
	var token string

	if len(args) > 0 {
		token = args[0]
	} else {
		// Prompt for token
		fmt.Print("Enter your Containr API token: ")
		fmt.Scanln(&token)
	}

	if token == "" {
		return fmt.Errorf("token is required")
	}

	// Store token in config
	viper.Set("token", token)
	if err := viper.WriteConfig(); err != nil {
		return fmt.Errorf("failed to save token: %w", err)
	}

	fmt.Println("✓ Successfully logged in to Containr")
	return nil
}

func runLogout(cmd *cobra.Command, args []string) error {
	// Remove token from config
	viper.Set("token", "")
	if err := viper.WriteConfig(); err != nil {
		return fmt.Errorf("failed to remove token: %w", err)
	}

	fmt.Println("✓ Successfully logged out from Containr")
	return nil
}

func runStatus(cmd *cobra.Command, args []string) error {
	token := viper.GetString("token")
	if token == "" {
		fmt.Println("❌ Not authenticated")
		fmt.Println("Run 'containr auth login <token>' to authenticate")
		return nil
	}

	fmt.Println("✓ Authenticated with Containr")
	apiURL := buildAPIURL("/user/profile")
	fmt.Printf("API URL: %s\n", strings.TrimSuffix(buildAPIURL(""), "/"))

	req, err := http.NewRequest(http.MethodGet, apiURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create verification request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("⚠ Token verification unavailable: %v\n", err)
		return nil
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		fmt.Println("✓ Token verified against API")
	case http.StatusUnauthorized, http.StatusForbidden:
		fmt.Println("❌ Token rejected by API (expired/invalid)")
	default:
		fmt.Printf("⚠ Token verification returned unexpected status: %s\n", resp.Status)
	}

	return nil
}

func buildAPIURL(endpoint string) string {
	baseURL := viper.GetString("api-url")
	if baseURL == "" {
		baseURL = "http://localhost:8080/api/v1"
	}
	baseURL = strings.TrimSuffix(baseURL, "/")
	if endpoint == "" {
		return baseURL
	}
	if !strings.HasPrefix(endpoint, "/") {
		endpoint = "/" + endpoint
	}
	return baseURL + endpoint
}
