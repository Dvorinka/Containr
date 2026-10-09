package commands

import (
	"github.com/spf13/cobra"
)

// OperationsCmd shows the cross-cutting operations view.
var OperationsCmd = &cobra.Command{
	Use:     "operations",
	Aliases: []string{"ops"},
	Short:   "Show active and recent platform work (deploys, cron, backups)",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/operations", nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}
