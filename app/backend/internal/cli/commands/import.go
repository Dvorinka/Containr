package commands

import (
	"fmt"
	"io"
	"os"

	"github.com/spf13/cobra"
)

var importVars []string

var ImportCmd = &cobra.Command{
	Use:   "import",
	Short: "Import external definitions into Containr",
}

var importComposeCmd = &cobra.Command{
	Use:   "compose <project-id> <compose.yml|->",
	Short: "Deploy a docker-compose file straight into a project (no template)",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		var raw []byte
		var err error
		if args[1] == "-" {
			raw, err = io.ReadAll(os.Stdin)
		} else {
			raw, err = os.ReadFile(args[1])
		}
		if err != nil {
			return fmt.Errorf("cannot read compose file: %w", err)
		}
		vars, err := parseKVFlags(importVars)
		if err != nil {
			return err
		}
		c, err := client()
		if err != nil {
			return err
		}
		body := map[string]interface{}{"compose_yaml": string(raw)}
		if len(vars) > 0 {
			body["variables"] = vars
		}
		data, err := c.Do("POST", "/projects/"+args[0]+"/import-compose", body)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

func init() {
	importComposeCmd.Flags().StringArrayVar(&importVars, "var", nil, "Variable override (KEY=VALUE, repeatable)")
	ImportCmd.AddCommand(importComposeCmd)
}
