package commands

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// TemplatesCmd manages the template catalog.
var TemplatesCmd = &cobra.Command{
	Use:     "templates",
	Aliases: []string{"template"},
	Short:   "Browse and deploy templates",
}

var templatesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List templates",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/templates", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "templates")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, t := range items {
			rows = append(rows, []string{
				str(t, "id"), str(t, "name"), str(t, "category"), str(t, "description"),
			})
		}
		printRows(data, []string{"ID", "NAME", "CATEGORY", "DESCRIPTION"}, rows)
		return nil
	},
}

var templatesGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Show a template definition",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/templates/"+args[0], nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var templatesCreateCmd = &cobra.Command{
	Use:   "create <file>",
	Short: "Create a user template from a JSON file",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		raw, err := os.ReadFile(args[0])
		if err != nil {
			return fmt.Errorf("cannot read %s: %w", args[0], err)
		}
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/templates", raw)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var templatesDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a user template",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if !Confirm(fmt.Sprintf("Delete template %s?", args[0])) {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		if _, err := c.Do("DELETE", "/templates/"+args[0], nil); err != nil {
			return err
		}
		if JSONMode() {
			return PrintJSON(map[string]string{"status": "deleted", "id": args[0]})
		}
		fmt.Printf("Deleted template %s\n", args[0])
		return nil
	},
}

var templatesDeployCmd = &cobra.Command{
	Use:   "deploy <template-id> <project-id>",
	Short: "Deploy a template into a project",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/templates/"+args[0]+"/deploy", map[string]string{"project_id": args[1]})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

func init() {
	TemplatesCmd.AddCommand(templatesListCmd, templatesGetCmd, templatesCreateCmd, templatesDeleteCmd, templatesDeployCmd)
}
