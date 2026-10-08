package commands

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

// VariablesCmd manages service environment variables.
var VariablesCmd = &cobra.Command{
	Use:     "variables",
	Aliases: []string{"vars", "env"},
	Short:   "Manage service environment variables",
}

var varsListCmd = &cobra.Command{
	Use:   "list <service-id>",
	Short: "List variables (secrets shown masked)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/services/"+args[0]+"/variables", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "variables")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, v := range items {
			rows = append(rows, []string{str(v, "key"), str(v, "value"), str(v, "is_secret")})
		}
		printRows(data, []string{"KEY", "VALUE", "SECRET"}, rows)
		return nil
	},
}

// Variables are replaced wholesale server-side — set/unset fetch the
// current list, mutate it, and PUT it back. Masked secret placeholders are
// preserved by the server.
var varsSetCmd = &cobra.Command{
	Use:   "set <service-id> KEY=VALUE [KEY=VALUE...]",
	Short: "Set one or more variables",
	Args:  cobra.MinimumNArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		secret, _ := cmd.Flags().GetBool("secret")
		return mutateVars(args[0], func(vars []map[string]interface{}) []map[string]interface{} {
			for _, pair := range args[1:] {
				k, v, found := strings.Cut(pair, "=")
				if !found || k == "" {
					continue
				}
				vars = upsertVar(vars, k, v, secret)
			}
			return vars
		})
	},
}

var varsUnsetCmd = &cobra.Command{
	Use:   "unset <service-id> KEY [KEY...]",
	Short: "Remove variables",
	Args:  cobra.MinimumNArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		drop := map[string]bool{}
		for _, k := range args[1:] {
			drop[k] = true
		}
		return mutateVars(args[0], func(vars []map[string]interface{}) []map[string]interface{} {
			out := vars[:0]
			for _, v := range vars {
				if !drop[str(v, "key")] {
					out = append(out, v)
				}
			}
			return out
		})
	},
}

func fetchVars(c *Client, serviceID string) ([]map[string]interface{}, error) {
	data, err := c.Do("GET", "/services/"+serviceID+"/variables", nil)
	if err != nil {
		return nil, err
	}
	return unwrapList(data, "variables")
}

func mutateVars(serviceID string, mutate func([]map[string]interface{}) []map[string]interface{}) error {
	c, err := client()
	if err != nil {
		return err
	}
	vars, err := fetchVars(c, serviceID)
	if err != nil {
		return err
	}
	vars = mutate(vars)
	payload := make([]map[string]interface{}, 0, len(vars))
	for _, v := range vars {
		payload = append(payload, map[string]interface{}{
			"key":       str(v, "key"),
			"value":     str(v, "value"),
			"is_secret": v["is_secret"] == true,
		})
	}
	data, err := c.Do("PUT", "/services/"+serviceID+"/variables", map[string]interface{}{"variables": payload})
	if err != nil {
		return err
	}
	if JSONMode() {
		PrintRaw(data)
		return nil
	}
	fmt.Printf("Variables updated on %s — redeploy to apply to running containers\n", serviceID)
	return nil
}

func upsertVar(vars []map[string]interface{}, key, value string, secret bool) []map[string]interface{} {
	for _, v := range vars {
		if str(v, "key") == key {
			v["value"] = value
			v["is_secret"] = secret
			return vars
		}
	}
	return append(vars, map[string]interface{}{"key": key, "value": value, "is_secret": secret})
}

func init() {
	varsSetCmd.Flags().Bool("secret", false, "mark the variable(s) as secret")
	VariablesCmd.AddCommand(varsListCmd, varsSetCmd, varsUnsetCmd)
}
