package commands

import (
	"github.com/spf13/cobra"
)

var inviteEmail string
var inviteTTL int

// InvitesCmd manages team invite links (admin).
var InvitesCmd = &cobra.Command{
	Use:   "invites",
	Short: "Manage team invite links (admin)",
}

var inviteListCmd = &cobra.Command{
	Use:   "list",
	Short: "List invites",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/admin/invites", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "invites")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, i := range items {
			state := "open"
			if _, used := i["used_at"]; used && i["used_at"] != nil {
				state = "used"
			}
			rows = append(rows, []string{
				str(i, "id"), str(i, "email"), str(i, "expires_at"), state,
			})
		}
		printRows(data, []string{"ID", "EMAIL", "EXPIRES", "STATE"}, rows)
		return nil
	},
}

var inviteCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create an invite link (--email to bind, --hours for TTL)",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		req := map[string]interface{}{}
		if cmd.Flags().Changed("email") {
			req["email"] = inviteEmail
		}
		if cmd.Flags().Changed("hours") {
			req["expires_in_hours"] = inviteTTL
		}
		data, err := c.Do("POST", "/admin/invites", req)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var inviteRevokeCmd = &cobra.Command{
	Use:   "revoke <id>",
	Short: "Revoke an invite",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if !Confirm("Revoke invite " + args[0] + "?") {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		c, err := client()
		if err != nil {
			return err
		}
		_, err = c.Do("DELETE", "/admin/invites/"+args[0], nil)
		return err
	},
}

func init() {
	inviteCreateCmd.Flags().StringVar(&inviteEmail, "email", "", "bind invite to this email")
	inviteCreateCmd.Flags().IntVar(&inviteTTL, "hours", 168, "invite lifetime in hours (1-2160)")
	InvitesCmd.AddCommand(inviteListCmd, inviteCreateCmd, inviteRevokeCmd)
}
