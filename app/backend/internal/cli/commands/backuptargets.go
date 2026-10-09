package commands

import (
	"fmt"

	"github.com/spf13/cobra"
)

// BackupTargetsCmd manages S3-compatible backup destinations.
var BackupTargetsCmd = &cobra.Command{
	Use:     "backup-targets",
	Aliases: []string{"backup-target", "targets"},
	Short:   "Manage S3-compatible backup targets",
}

var btListCmd = &cobra.Command{
	Use:   "list",
	Short: "List backup targets",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/backup-targets", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "backup_targets")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, t := range items {
			creds := "no"
			if str(t, "has_credentials") == "true" {
				creds = "yes"
			}
			rows = append(rows, []string{str(t, "id"), str(t, "name"), str(t, "endpoint"), str(t, "bucket"), creds})
		}
		printRows(data, []string{"ID", "NAME", "ENDPOINT", "BUCKET", "CREDS"}, rows)
		return nil
	},
}

var btAddCmd = &cobra.Command{
	Use:   "add <name>",
	Short: "Register an S3-compatible backup target (probed before storing)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		body := map[string]interface{}{"name": args[0]}
		for _, f := range []string{"endpoint", "bucket", "region", "prefix", "access-key", "secret-key"} {
			if v, _ := cmd.Flags().GetString(f); v != "" {
				key := f
				switch f {
				case "access-key":
					key = "access_key"
				case "secret-key":
					key = "secret_key"
				}
				body[key] = v
			}
		}
		if cmd.Flags().Changed("no-tls") {
			v, _ := cmd.Flags().GetBool("no-tls")
			body["use_tls"] = !v
		}
		data, err := c.Do("POST", "/backup-targets", body)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var btUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update a backup target (re-probed; empty keys keep stored credentials)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		body := map[string]interface{}{}
		// endpoint/bucket are required by the API — fall back to stored values.
		for _, f := range []string{"name", "endpoint", "bucket", "region", "prefix", "access-key", "secret-key"} {
			if v, _ := cmd.Flags().GetString(f); v != "" {
				key := f
				switch f {
				case "access-key":
					key = "access_key"
				case "secret-key":
					key = "secret_key"
				}
				body[key] = v
			}
		}
		if _, hasEndpoint := body["endpoint"]; !hasEndpoint {
			data, err := c.Do("GET", "/backup-targets", nil)
			if err != nil {
				return err
			}
			items, err := unwrapList(data, "backup_targets")
			if err != nil {
				return err
			}
			for _, t := range items {
				if str(t, "id") == args[0] {
					body["endpoint"] = str(t, "endpoint")
					if _, ok := body["bucket"]; !ok {
						body["bucket"] = str(t, "bucket")
					}
					if _, ok := body["name"]; !ok {
						body["name"] = str(t, "name")
					}
					break
				}
			}
		}
		if cmd.Flags().Changed("no-tls") {
			v, _ := cmd.Flags().GetBool("no-tls")
			body["use_tls"] = !v
		}
		data, err := c.Do("PUT", "/backup-targets/"+args[0], body)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var btRemoveCmd = &cobra.Command{
	Use:   "remove <id>",
	Short: "Delete a backup target (fails while databases still point at it)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if !Confirm(fmt.Sprintf("Delete backup target %s?", args[0])) {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		if _, err := c.Do("DELETE", "/backup-targets/"+args[0], nil); err != nil {
			return err
		}
		if JSONMode() {
			return PrintJSON(map[string]string{"status": "deleted", "id": args[0]})
		}
		fmt.Printf("Deleted backup target %s\n", args[0])
		return nil
	},
}

var btTestCmd = &cobra.Command{
	Use:   "test <id>",
	Short: "Re-probe a backup target's bucket access",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/backup-targets/"+args[0]+"/test", nil)
		if err != nil {
			return err
		}
		m, _ := unwrapObject(data)
		if str(m, "ok") == "false" {
			return &APIError{Message: "probe failed: " + str(m, "error"), ExitCode: ExitError}
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		fmt.Printf("Target ok (%sms)\n", str(m, "latency_ms"))
		return nil
	},
}

func init() {
	btAddCmd.Flags().String("endpoint", "", "S3 endpoint host[:port] (e.g. s3.amazonaws.com, garage.local:3900)")
	btAddCmd.Flags().String("bucket", "", "bucket name")
	btAddCmd.Flags().String("region", "", "region (optional for most S3-compatible stores)")
	btAddCmd.Flags().String("prefix", "", "key prefix for archives")
	btAddCmd.Flags().String("access-key", "", "access key (stored encrypted)")
	btAddCmd.Flags().String("secret-key", "", "secret key (stored encrypted)")
	btAddCmd.Flags().Bool("no-tls", false, "use plain HTTP")
	btUpdateCmd.Flags().String("name", "", "new name")
	btUpdateCmd.Flags().String("endpoint", "", "S3 endpoint host[:port]")
	btUpdateCmd.Flags().String("bucket", "", "bucket name")
	btUpdateCmd.Flags().String("region", "", "region")
	btUpdateCmd.Flags().String("prefix", "", "key prefix")
	btUpdateCmd.Flags().String("access-key", "", "access key")
	btUpdateCmd.Flags().String("secret-key", "", "secret key")
	btUpdateCmd.Flags().Bool("no-tls", false, "use plain HTTP")
	BackupTargetsCmd.AddCommand(btListCmd, btAddCmd, btUpdateCmd, btRemoveCmd, btTestCmd)
}
