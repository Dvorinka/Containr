package commands

import (
	"fmt"

	"github.com/spf13/cobra"
)

// DeployCmd triggers a deployment for a service.
var DeployCmd = &cobra.Command{
	Use:   "deploy <service-id>",
	Short: "Trigger a deployment",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		body := map[string]interface{}{"trigger": "cli"}
		for _, f := range []string{"commit-hash", "branch"} {
			if v, _ := cmd.Flags().GetString(f); v != "" {
				key := "commit_hash"
				if f == "branch" {
					key = "branch"
				}
				body[key] = v
			}
		}
		data, err := c.Do("POST", "/services/"+args[0]+"/deployments", body)
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		d, _ := unwrapObject(data, "deployment")
		fmt.Printf("Deployment %s started for service %s (status: %s)\n",
			str(d, "id"), args[0], str(d, "status"))
		fmt.Println("Follow with: containr deployments logs " + str(d, "id"))
		return nil
	},
}

// DeploymentsCmd manages deployment history.
var DeploymentsCmd = &cobra.Command{
	Use:     "deployments",
	Aliases: []string{"deployment"},
	Short:   "Inspect deployments",
}

var deploymentsListCmd = &cobra.Command{
	Use:   "list [service-id]",
	Short: "List deployments (all recent, or for one service)",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		path := "/deployments"
		if len(args) > 0 {
			path = "/services/" + args[0] + "/deployments"
		}
		data, err := c.Do("GET", path, nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "deployments")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, d := range items {
			rows = append(rows, []string{
				str(d, "id"), str(d, "service_id"), str(d, "status"), str(d, "trigger"), relTime(d, "created_at", "started_at"),
			})
		}
		printRows(data, []string{"ID", "SERVICE", "STATUS", "TRIGGER", "STARTED"}, rows)
		return nil
	},
}

var deploymentsGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Show a deployment",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/deployments/"+args[0], nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var deploymentsLogsCmd = &cobra.Command{
	Use:   "logs <id>",
	Short: "Stream a deployment's build/deploy logs",
	Args:  cobra.ExactArgs(1),
	RunE:  runDeploymentLogs,
}

var deploymentsRollbackCmd = &cobra.Command{
	Use:   "rollback <id>",
	Short: "Roll back to a deployment",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/deployments/"+args[0]+"/rollback", map[string]interface{}{})
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		fmt.Printf("Rolled back to deployment %s\n", args[0])
		return nil
	},
}

func init() {
	DeployCmd.Flags().String("commit-hash", "", "commit to deploy")
	DeployCmd.Flags().String("branch", "", "branch to deploy")
	DeploymentsCmd.AddCommand(deploymentsListCmd, deploymentsGetCmd, deploymentsLogsCmd, deploymentsRollbackCmd)
}
