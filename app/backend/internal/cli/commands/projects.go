package commands

import (
	"fmt"

	"github.com/spf13/cobra"
)

// ProjectsCmd manages projects.
var ProjectsCmd = &cobra.Command{
	Use:     "projects",
	Aliases: []string{"project"},
	Short:   "Manage projects",
}

var projectsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List projects",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/projects", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "projects")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, p := range items {
			rows = append(rows, []string{
				str(p, "id"), str(p, "name"), str(p, "description"), relTime(p, "created_at"),
			})
		}
		printRows(data, []string{"ID", "NAME", "DESCRIPTION", "CREATED"}, rows)
		return nil
	},
}

var projectsGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Show a project",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/projects/"+args[0], nil)
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		p, _ := unwrapObject(data, "project")
		fmt.Printf("ID:          %s\n", str(p, "id"))
		fmt.Printf("Name:        %s\n", str(p, "name"))
		fmt.Printf("Description: %s\n", str(p, "description"))
		fmt.Printf("Created:     %s\n", str(p, "created_at"))
		return nil
	},
}

var projectsCreateCmd = &cobra.Command{
	Use:   "create <name>",
	Short: "Create a project",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		desc, _ := cmd.Flags().GetString("description")
		body := map[string]interface{}{"name": args[0]}
		if desc != "" {
			body["description"] = desc
		}
		data, err := c.Do("POST", "/projects", body)
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		p, _ := unwrapObject(data, "project")
		fmt.Printf("Created project %s (%s)\n", str(p, "name"), str(p, "id"))
		return nil
	},
}

var projectsDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a project and all its services",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if !Confirm(fmt.Sprintf("Delete project %s and all its services?", args[0])) {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		if _, err := c.Do("DELETE", "/projects/"+args[0], nil); err != nil {
			return err
		}
		if JSONMode() {
			return PrintJSON(map[string]string{"status": "deleted", "id": args[0]})
		}
		fmt.Printf("Deleted project %s\n", args[0])
		return nil
	},
}

func init() {
	projectsCreateCmd.Flags().StringP("description", "d", "", "project description")
	ProjectsCmd.AddCommand(projectsListCmd, projectsGetCmd, projectsCreateCmd, projectsDeleteCmd)
}
