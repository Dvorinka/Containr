package commands

import (
	"fmt"

	"github.com/spf13/cobra"
)

// RegistriesCmd manages private-image registry credentials.
var RegistriesCmd = &cobra.Command{
	Use:     "registries",
	Aliases: []string{"registry"},
	Short:   "Manage registry credentials",
}

var registriesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List registry credentials",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/registries", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "registries")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, r := range items {
			hasPw := ""
			if b, ok := r["has_password"].(bool); ok && b {
				hasPw = "yes"
			}
			rows = append(rows, []string{str(r, "id"), str(r, "name"), str(r, "host"), str(r, "username"), hasPw})
		}
		printRows(data, []string{"ID", "NAME", "HOST", "USERNAME", "PASSWORD"}, rows)
		return nil
	},
}

var registriesAddCmd = &cobra.Command{
	Use:   "add <name> <host>",
	Short: "Add a registry credential (e.g. ghcr.io, registry.example.com, docker.io)",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		body := map[string]interface{}{"name": args[0], "host": args[1]}
		if v, _ := cmd.Flags().GetString("username"); v != "" {
			body["username"] = v
		}
		if v, _ := cmd.Flags().GetString("password"); v != "" {
			body["password"] = v
		}
		data, err := c.Do("POST", "/registries", body)
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		r, _ := unwrapObject(data, "registry")
		fmt.Printf("Added registry %s (%s)\n", str(r, "name"), str(r, "host"))
		return nil
	},
}

var registriesUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update a registry credential (empty --password keeps the stored one)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		body := map[string]interface{}{}
		for _, f := range []string{"name", "host", "username", "password"} {
			if cmd.Flags().Changed(f) {
				v, _ := cmd.Flags().GetString(f)
				body[f] = v
			}
		}
		if len(body) == 0 {
			return &APIError{Message: "nothing to update — pass a flag", ExitCode: ExitError}
		}
		// The API requires name+host — backfill them from the stored row
		// when the caller didn't supply both.
		_, hasName := body["name"]
		_, hasHost := body["host"]
		if !hasName || !hasHost {
			data, err := c.Do("GET", "/registries", nil)
			if err != nil {
				return err
			}
			items, _ := unwrapList(data, "registries")
			for _, r := range items {
				if str(r, "id") == args[0] {
					if !hasName {
						body["name"] = str(r, "name")
					}
					if !hasHost {
						body["host"] = str(r, "host")
					}
				}
			}
		}
		data, err := c.Do("PUT", "/registries/"+args[0], body)
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		fmt.Printf("Updated registry %s\n", args[0])
		return nil
	},
}

var registriesRemoveCmd = &cobra.Command{
	Use:   "remove <id>",
	Short: "Remove a registry credential",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if !Confirm(fmt.Sprintf("Remove registry %s?", args[0])) {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		if _, err := c.Do("DELETE", "/registries/"+args[0], nil); err != nil {
			return err
		}
		if JSONMode() {
			return PrintJSON(map[string]string{"status": "deleted", "id": args[0]})
		}
		fmt.Printf("Removed registry %s\n", args[0])
		return nil
	},
}

func init() {
	registriesAddCmd.Flags().String("username", "", "registry username")
	registriesAddCmd.Flags().String("password", "", "registry password/token (stored encrypted)")
	registriesUpdateCmd.Flags().String("name", "", "display name")
	registriesUpdateCmd.Flags().String("host", "", "registry host")
	registriesUpdateCmd.Flags().String("username", "", "registry username")
	registriesUpdateCmd.Flags().String("password", "", "registry password/token")
	RegistriesCmd.AddCommand(registriesListCmd, registriesAddCmd, registriesUpdateCmd, registriesRemoveCmd)
}
