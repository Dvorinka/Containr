package commands

import (
	"fmt"

	"github.com/spf13/cobra"
)

// CronCmd manages scheduled jobs.
var CronCmd = &cobra.Command{
	Use:     "cron",
	Aliases: []string{"cron-jobs"},
	Short:   "Manage cron jobs",
}

var cronListCmd = &cobra.Command{
	Use:   "list",
	Short: "List cron jobs",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/cron-jobs", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "cron_jobs", "jobs")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, j := range items {
			rows = append(rows, []string{
				str(j, "id"), str(j, "name"), str(j, "schedule"), str(j, "service_id"),
				str(j, "enabled", "is_active"), relTime(j, "last_run_at"),
			})
		}
		printRows(data, []string{"ID", "NAME", "SCHEDULE", "SERVICE", "ENABLED", "LAST RUN"}, rows)
		return nil
	},
}

var cronGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Show a cron job",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/cron-jobs/"+args[0], nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var cronCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a cron job (5-field expression)",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		body := map[string]interface{}{}
		for _, f := range []string{"name", "schedule", "command", "service-id", "timezone"} {
			v, _ := cmd.Flags().GetString(f)
			if v != "" {
				key := f
				if f == "service-id" {
					key = "service_id"
				}
				body[key] = v
			}
		}
		if body["service_id"] == nil || body["schedule"] == nil || body["command"] == nil {
			return &APIError{Message: "--service-id, --schedule, and --command are required", ExitCode: ExitValidation}
		}
		data, err := c.Do("POST", "/cron-jobs", body)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var cronDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a cron job",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if !Confirm(fmt.Sprintf("Delete cron job %s?", args[0])) {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		if _, err := c.Do("DELETE", "/cron-jobs/"+args[0], nil); err != nil {
			return err
		}
		if JSONMode() {
			return PrintJSON(map[string]string{"status": "deleted", "id": args[0]})
		}
		fmt.Printf("Deleted cron job %s\n", args[0])
		return nil
	},
}

var cronTriggerCmd = &cobra.Command{
	Use:   "trigger <id>",
	Short: "Run a cron job now",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/cron-jobs/"+args[0]+"/trigger", map[string]interface{}{})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var cronExecutionsCmd = &cobra.Command{
	Use:   "executions <id>",
	Short: "List a cron job's execution history",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/cron-jobs/"+args[0]+"/executions", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "executions")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, e := range items {
			rows = append(rows, []string{
				str(e, "id"), str(e, "status", "exit_code"), str(e, "started_at"), str(e, "output", "stdout"),
			})
		}
		printRows(data, []string{"ID", "STATUS", "STARTED", "OUTPUT"}, rows)
		return nil
	},
}

func init() {
	cronCreateCmd.Flags().String("name", "", "job name")
	cronCreateCmd.Flags().String("service-id", "", "target service id (required)")
	cronCreateCmd.Flags().String("schedule", "", "5-field cron expression (required)")
	cronCreateCmd.Flags().String("command", "", "command run inside the container (required)")
	cronCreateCmd.Flags().String("timezone", "", "IANA timezone (default UTC)")
	CronCmd.AddCommand(cronListCmd, cronGetCmd, cronCreateCmd, cronDeleteCmd, cronTriggerCmd, cronExecutionsCmd)
}
