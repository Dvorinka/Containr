package commands

import (
	"fmt"

	"github.com/spf13/cobra"
)

// ServicesCmd manages services.
var ServicesCmd = &cobra.Command{
	Use:     "services",
	Aliases: []string{"service", "svc"},
	Short:   "Manage services",
}

var servicesListCmd = &cobra.Command{
	Use:   "list [project-id]",
	Short: "List services in a project",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/projects/"+args[0]+"/services", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "services")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, s := range items {
			rows = append(rows, []string{
				str(s, "id"), str(s, "name"), str(s, "type"), str(s, "status"), str(s, "environment"),
			})
		}
		printRows(data, []string{"ID", "NAME", "TYPE", "STATUS", "ENV"}, rows)
		return nil
	},
}

var servicesGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Show a service",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/services/"+args[0], nil)
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		s, _ := unwrapObject(data, "service")
		for _, k := range []string{"id", "name", "type", "status", "environment", "image", "git_repo", "git_branch", "domain", "port"} {
			fmt.Printf("%-14s %s\n", k+":", str(s, k))
		}
		return nil
	},
}

var servicesCreateCmd = &cobra.Command{
	Use:   "create <project-id> <name>",
	Short: "Create a service (image- or git-based)",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		body := map[string]interface{}{
			"name": args[1],
		}
		for _, f := range []string{"type", "image", "git-repo", "git-branch", "build-path", "command", "environment", "domain", "restart-policy", "healthcheck-path", "cpu", "memory"} {
			if v, _ := cmd.Flags().GetString(f); v != "" {
				key := f
				// JSON uses snake_case keys matching the API schema.
				switch f {
				case "git-repo":
					key = "git_repo"
				case "git-branch":
					key = "git_branch"
				case "build-path":
					key = "build_path"
				case "restart-policy":
					key = "restart_policy"
				case "healthcheck-path":
					key = "healthcheck_path"
				}
				body[key] = v
			}
		}
		if v, _ := cmd.Flags().GetInt("port"); v > 0 {
			body["port"] = v
		}
		if v, _ := cmd.Flags().GetInt("replicas"); v > 0 {
			body["replicas"] = v
		}
		data, err := c.Do("POST", "/projects/"+args[0]+"/services", body)
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		s, _ := unwrapObject(data, "service")
		fmt.Printf("Created service %s (%s)\n", str(s, "name"), str(s, "id"))
		return nil
	},
}

var servicesDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a service",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if !Confirm(fmt.Sprintf("Delete service %s?", args[0])) {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		if _, err := c.Do("DELETE", "/services/"+args[0], nil); err != nil {
			return err
		}
		if JSONMode() {
			return PrintJSON(map[string]string{"status": "deleted", "id": args[0]})
		}
		fmt.Printf("Deleted service %s\n", args[0])
		return nil
	},
}

// serviceAction returns a RunE for the simple POST action endpoints.
func serviceAction(verb string) func(*cobra.Command, []string) error {
	return func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", fmt.Sprintf("/services/%s/%s", args[0], verb), map[string]interface{}{})
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		fmt.Printf("%s: %s\n", verb, args[0])
		return nil
	}
}

func init() {
	f := servicesCreateCmd.Flags()
	f.String("type", "web", "service type: web|worker|database|cron")
	f.String("image", "", "container image (image-based service)")
	f.String("git-repo", "", "git repository URL (build-from-source service)")
	f.String("git-branch", "main", "git branch")
	f.String("build-path", "", "build context subdirectory")
	f.String("command", "", "container start command override")
	f.String("environment", "production", "production|preview|development")
	f.String("domain", "", "public domain")
	f.String("restart-policy", "unless-stopped", "docker restart policy")
	f.String("healthcheck-path", "", "HTTP health check path")
	f.String("cpu", "", "CPU limit (e.g. 0.5)")
	f.String("memory", "", "memory limit (e.g. 512m)")
	f.Int("port", 0, "container port")
	f.Int("replicas", 0, "replica count")

	for _, a := range []string{"start", "stop", "restart", "redeploy"} {
		verb := a
		ServicesCmd.AddCommand(&cobra.Command{
			Use:   verb + " <id>",
			Short: verb + " a service",
			Args:  cobra.ExactArgs(1),
			RunE:  serviceAction(verb),
		})
	}
	ServicesCmd.AddCommand(servicesListCmd, servicesGetCmd, servicesCreateCmd, servicesDeleteCmd)
}
