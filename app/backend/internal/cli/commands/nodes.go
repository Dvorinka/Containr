package commands

import (
	"fmt"

	"github.com/spf13/cobra"
)

// NodesCmd manages node agents (admin).
var NodesCmd = &cobra.Command{
	Use:     "nodes",
	Aliases: []string{"node", "agents"},
	Short:   "Manage node agents (admin)",
}

var nodesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List registered node agents",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/agents", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "agents")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, a := range items {
			rows = append(rows, []string{
				str(a, "id"), str(a, "name", "hostname"), str(a, "status"), str(a, "version"), relTime(a, "last_heartbeat_at"),
			})
		}
		printRows(data, []string{"ID", "NAME", "STATUS", "VERSION", "HEARTBEAT"}, rows)
		return nil
	},
}

var nodesGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Show a node agent",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/agents/"+args[0], nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var nodesDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Remove a node agent",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if !Confirm(fmt.Sprintf("Remove node agent %s?", args[0])) {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		if _, err := c.Do("DELETE", "/agents/"+args[0], nil); err != nil {
			return err
		}
		if JSONMode() {
			return PrintJSON(map[string]string{"status": "deleted", "id": args[0]})
		}
		fmt.Printf("Removed agent %s\n", args[0])
		return nil
	},
}

var nodesUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update a node agent (--name, --auto-prune)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		body := map[string]interface{}{}
		if cmd.Flags().Changed("name") {
			body["name"], _ = cmd.Flags().GetString("name")
		}
		if cmd.Flags().Changed("auto-prune") {
			body["auto_prune"], _ = cmd.Flags().GetBool("auto-prune")
		}
		if len(body) == 0 {
			return &APIError{Message: "nothing to update — pass --name or --auto-prune", ExitCode: ExitError}
		}
		data, err := c.Do("PUT", "/agents/"+args[0], body)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var nodesPruneCmd = &cobra.Command{
	Use:   "prune <id>",
	Short: "Enqueue a bounded docker system prune on a node",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		volumes, _ := cmd.Flags().GetBool("volumes")
		if volumes && !Confirm("Prune INCLUDING volumes? This can delete database data.") {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		until, _ := cmd.Flags().GetString("until")
		data, err := c.Do("POST", "/agents/"+args[0]+"/prune",
			map[string]interface{}{"until": until, "volumes": volumes})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var nodesCommandsCmd = &cobra.Command{
	Use:   "commands <id>",
	Short: "List recent commands sent to a node agent",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/agents/"+args[0]+"/commands", nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

// Agent tokens (cagt_) onboard new nodes.
var nodeTokensCmd = &cobra.Command{
	Use:   "tokens",
	Short: "Manage agent onboarding tokens",
}

var nodeTokensIssueCmd = &cobra.Command{
	Use:   "issue [label]",
	Short: "Issue an onboarding token (shown once)",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		body := map[string]interface{}{}
		if len(args) > 0 {
			body["label"] = args[0]
		}
		data, err := c.Do("POST", "/agent-tokens", body)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var nodeTokensListCmd = &cobra.Command{
	Use:   "list",
	Short: "List onboarding tokens",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/agent-tokens", nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var nodeTokensRevokeCmd = &cobra.Command{
	Use:   "revoke <id>",
	Short: "Revoke an onboarding token",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("DELETE", "/agent-tokens/"+args[0], nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

func init() {
	nodesUpdateCmd.Flags().String("name", "", "node display name")
	nodesUpdateCmd.Flags().Bool("auto-prune", false, "enqueue a daily bounded docker prune")
	nodesPruneCmd.Flags().String("until", "", "only prune objects older than this duration (e.g. 168h)")
	nodesPruneCmd.Flags().Bool("volumes", false, "also prune volumes (destructive — asks twice)")
	nodeTokensCmd.AddCommand(nodeTokensIssueCmd, nodeTokensListCmd, nodeTokensRevokeCmd)
	NodesCmd.AddCommand(nodesListCmd, nodesGetCmd, nodesUpdateCmd, nodesPruneCmd, nodesCommandsCmd, nodesDeleteCmd, nodeTokensCmd)
}
