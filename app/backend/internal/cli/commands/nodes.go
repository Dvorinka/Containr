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
	nodeTokensCmd.AddCommand(nodeTokensIssueCmd, nodeTokensListCmd, nodeTokensRevokeCmd)
	NodesCmd.AddCommand(nodesListCmd, nodesGetCmd, nodesDeleteCmd, nodeTokensCmd)
}
