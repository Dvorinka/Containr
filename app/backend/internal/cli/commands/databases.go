package commands

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// DatabasesCmd manages managed databases.
var DatabasesCmd = &cobra.Command{
	Use:     "databases",
	Aliases: []string{"database", "db"},
	Short:   "Manage databases",
}

var dbListCmd = &cobra.Command{
	Use:   "list",
	Short: "List managed databases",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/databases", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "databases")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, d := range items {
			rows = append(rows, []string{
				str(d, "id"), str(d, "name"), str(d, "type", "engine"), str(d, "status"),
			})
		}
		printRows(data, []string{"ID", "NAME", "TYPE", "STATUS"}, rows)
		return nil
	},
}

var dbGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Show a database (connection URL included)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/databases/"+args[0], nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var dbCreateCmd = &cobra.Command{
	Use:   "create <name>",
	Short: "Provision a managed database",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		dbType, _ := cmd.Flags().GetString("type")
		body := map[string]interface{}{"name": args[0], "type": dbType}
		for _, f := range []string{"version", "storage-size"} {
			if v, _ := cmd.Flags().GetString(f); v != "" {
				key := f
				if f == "storage-size" {
					key = "storage_size"
				}
				body[key] = v
			}
		}
		data, err := c.Do("POST", "/databases", body)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var dbDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a database and its data",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if !Confirm(fmt.Sprintf("Delete database %s and all its data?", args[0])) {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		if _, err := c.Do("DELETE", "/databases/"+args[0], nil); err != nil {
			return err
		}
		if JSONMode() {
			return PrintJSON(map[string]string{"status": "deleted", "id": args[0]})
		}
		fmt.Printf("Deleted database %s\n", args[0])
		return nil
	},
}

var dbActionCmd = &cobra.Command{
	Use:   "action <id> <start|stop|restart>",
	Short: "Start, stop, or restart a database",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/databases/"+args[0]+"/action", map[string]string{"action": args[1]})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var dbBackupCmd = &cobra.Command{
	Use:   "backup <id>",
	Short: "Take a manual backup snapshot",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/databases/"+args[0]+"/backup", map[string]interface{}{})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var dbRestoreCmd = &cobra.Command{
	Use:   "restore <id> <backup-id>",
	Short: "Restore a database from a backup",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if !Confirm(fmt.Sprintf("Restore database %s from backup %s? Current data will be overwritten.", args[0], args[1])) {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		data, err := c.Do("POST", "/databases/"+args[0]+"/restore", map[string]string{"backup_id": args[1]})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var dbDownloadCmd = &cobra.Command{
	Use:   "download-backup <id> <backup-id> [file]",
	Short: "Download a backup archive",
	Args:  cobra.RangeArgs(2, 3),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", fmt.Sprintf("/databases/%s/backups/%s/download", args[0], args[1]), nil)
		if err != nil {
			return err
		}
		out := args[1] + ".tar.gz"
		if len(args) > 2 {
			out = args[2]
		}
		if err := os.WriteFile(out, data, 0o600); err != nil {
			return err
		}
		if JSONMode() {
			return PrintJSON(map[string]string{"file": out})
		}
		fmt.Printf("Wrote %s (%d bytes)\n", out, len(data))
		return nil
	},
}

func init() {
	dbCreateCmd.Flags().String("type", "postgres", "postgres|mysql|mariadb|mongodb|redis|dragonfly|clickhouse")
	dbCreateCmd.Flags().String("version", "", "engine version tag")
	dbCreateCmd.Flags().String("storage-size", "", "volume size (e.g. 10Gi)")
	DatabasesCmd.AddCommand(dbListCmd, dbGetCmd, dbCreateCmd, dbDeleteCmd, dbActionCmd, dbBackupCmd, dbRestoreCmd, dbDownloadCmd)
}
