package commands

import (
	"fmt"

	"github.com/spf13/cobra"
)

// NotificationsCmd lists and manages notifications.
var NotificationsCmd = &cobra.Command{
	Use:     "notifications",
	Aliases: []string{"notifs"},
	Short:   "Manage notifications",
}

var notifListCmd = &cobra.Command{
	Use:   "list",
	Short: "List notifications",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/notifications", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "notifications")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, n := range items {
			rows = append(rows, []string{
				str(n, "id"), str(n, "type"), str(n, "title"), str(n, "read"), relTime(n, "created_at"),
			})
		}
		printRows(data, []string{"ID", "TYPE", "TITLE", "READ", "AGE"}, rows)
		return nil
	},
}

var notifReadCmd = &cobra.Command{
	Use:   "read <id>|all",
	Short: "Mark a notification (or all) as read",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		path := "/notifications/" + args[0] + "/read"
		if args[0] == "all" {
			path = "/notifications/read-all"
		}
		data, err := c.Do("POST", path, map[string]interface{}{})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var notifChannelsCmd = &cobra.Command{
	Use:   "channels",
	Short: "Manage push notification channels (ntfy/Gotify)",
}

var notifChannelsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List push channels",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/notifications/channels", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "channels")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, n := range items {
			rows = append(rows, []string{
				str(n, "id"), str(n, "kind"), str(n, "endpoint"), str(n, "enabled"), relTime(n, "created_at"),
			})
		}
		printRows(data, []string{"ID", "KIND", "ENDPOINT", "ENABLED", "AGE"}, rows)
		return nil
	},
}

var notifChannelsAddCmd = &cobra.Command{
	Use:   "add <ntfy|gotify> <endpoint>",
	Short: "Add a push channel (endpoint includes topic for ntfy)",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		token, _ := cmd.Flags().GetString("token")
		data, err := c.Do("POST", "/notifications/channels", map[string]interface{}{
			"kind":     args[0],
			"endpoint": args[1],
			"token":    token,
		})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var notifChannelsTestCmd = &cobra.Command{
	Use:   "test <id>",
	Short: "Send a test notification through a channel",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/notifications/channels/"+args[0]+"/test", map[string]interface{}{})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var notifChannelsRemoveCmd = &cobra.Command{
	Use:   "remove <id>",
	Short: "Remove a push channel",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		yes, _ := cmd.Flags().GetBool("yes")
		if !yes && !Confirm(fmt.Sprintf("Remove channel %s?", args[0])) {
			return nil
		}
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("DELETE", "/notifications/channels/"+args[0], nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

func init() {
	notifChannelsAddCmd.Flags().String("token", "", "Auth token (ntfy access token or Gotify app token)")
	notifChannelsRemoveCmd.Flags().Bool("yes", false, "Skip confirmation")
	notifChannelsCmd.AddCommand(notifChannelsListCmd, notifChannelsAddCmd, notifChannelsTestCmd, notifChannelsRemoveCmd)
	NotificationsCmd.AddCommand(notifListCmd, notifReadCmd, notifChannelsCmd)
}
