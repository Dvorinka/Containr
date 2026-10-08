package commands

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// TokensCmd manages personal access tokens (cnp_...).
var TokensCmd = &cobra.Command{
	Use:   "tokens",
	Short: "Manage personal access tokens",
	Long: `Create, list, and revoke the cnp_ tokens used by this CLI,
the MCP server, and external agents.`,
}

var tokensListCmd = &cobra.Command{
	Use:   "list",
	Short: "List your tokens (metadata only)",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/user/tokens", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "tokens")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, t := range items {
			rows = append(rows, []string{
				str(t, "id"), str(t, "name"), str(t, "key_prefix"), str(t, "scope"),
				relTime(t, "last_used_at"), str(t, "expires_at"),
			})
		}
		printRows(data, []string{"ID", "NAME", "PREFIX", "SCOPE", "LAST USED", "EXPIRES"}, rows)
		return nil
	},
}

var tokensCreateCmd = &cobra.Command{
	Use:   "create <name>",
	Short: "Create a token (raw value printed once)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		scope, _ := cmd.Flags().GetString("scope")
		days, _ := cmd.Flags().GetInt("expires-in-days")
		data, err := c.Do("POST", "/user/tokens", map[string]interface{}{
			"name": args[0], "scope": scope, "expires_in_days": days,
		})
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		t, _ := unwrapObject(data)
		fmt.Println(str(t, "token"))
		fmt.Fprintln(os.Stderr, "Store it now — it is shown only once. Scope: "+str(t, "scope"))
		return nil
	},
}

var tokensRevokeCmd = &cobra.Command{
	Use:   "revoke <id>",
	Short: "Revoke a token",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if !Confirm(fmt.Sprintf("Revoke token %s? Clients using it lose access immediately.", args[0])) {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		if _, err := c.Do("DELETE", "/user/tokens/"+args[0], nil); err != nil {
			return err
		}
		if JSONMode() {
			return PrintJSON(map[string]string{"status": "revoked", "id": args[0]})
		}
		fmt.Printf("Revoked token %s\n", args[0])
		return nil
	},
}

func init() {
	tokensCreateCmd.Flags().String("scope", "write", "read|write|admin (admin requires an admin account)")
	tokensCreateCmd.Flags().Int("expires-in-days", 0, "0 = never expires, max 3650")
	TokensCmd.AddCommand(tokensListCmd, tokensCreateCmd, tokensRevokeCmd)
}
