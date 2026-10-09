package commands

import (
	"fmt"

	"github.com/spf13/cobra"
)

// EnvironmentsCmd manages a project's environment lanes
// (production/development/preview are seeded; custom names allowed).
var EnvironmentsCmd = &cobra.Command{
	Use:     "environments",
	Aliases: []string{"env", "envs"},
	Short:   "Manage project environments",
}

var envListCmd = &cobra.Command{
	Use:   "list",
	Short: "List environments in a project",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		project, _ := cmd.Flags().GetString("project")
		if project == "" {
			return fmt.Errorf("--project is required")
		}
		data, err := c.Do("GET", "/projects/"+project+"/environments", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "environments")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, e := range items {
			rows = append(rows, []string{
				str(e, "id"), str(e, "name"), str(e, "service_count"), relTime(e, "created_at"),
			})
		}
		printRows(data, []string{"ID", "NAME", "SERVICES", "CREATED"}, rows)
		return nil
	},
}

var envCreateCmd = &cobra.Command{
	Use:   "create <name>",
	Short: "Create an environment in a project",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		project, _ := cmd.Flags().GetString("project")
		if project == "" {
			return fmt.Errorf("--project is required")
		}
		data, err := c.Do("POST", "/projects/"+project+"/environments", map[string]interface{}{
			"name": args[0],
		})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var envDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete an empty environment",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if !Confirm("Delete environment " + args[0] + "?") {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		c, err := client()
		if err != nil {
			return err
		}
		_, err = c.Do("DELETE", "/environments/"+args[0], nil)
		if err != nil {
			return err
		}
		fmt.Println("Environment deleted")
		return nil
	},
}

func init() {
	envListCmd.Flags().String("project", "", "project ID (required)")
	envCreateCmd.Flags().String("project", "", "project ID (required)")
	EnvironmentsCmd.AddCommand(envListCmd, envCreateCmd, envDeleteCmd)
}
