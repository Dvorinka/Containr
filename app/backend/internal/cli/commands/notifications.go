package commands

import (
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

func init() {
	NotificationsCmd.AddCommand(notifListCmd, notifReadCmd)
}
