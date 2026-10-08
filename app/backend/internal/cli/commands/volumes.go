package commands

import (
	"fmt"

	"github.com/spf13/cobra"
)

// VolumesCmd manages docker volumes on the node (admin).
var VolumesCmd = &cobra.Command{
	Use:     "volumes",
	Aliases: []string{"volume"},
	Short:   "Manage docker volumes (admin)",
}

var volumesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List docker volumes with in-use flags",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/admin/volumes", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "volumes")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, v := range items {
			inUse := "no"
			if b, ok := v["in_use"].(bool); ok && b {
				inUse = "yes"
			}
			rows = append(rows, []string{str(v, "name"), str(v, "driver"), inUse})
		}
		printRows(data, []string{"NAME", "DRIVER", "IN USE"}, rows)
		return nil
	},
}

var volumesDeleteCmd = &cobra.Command{
	Use:   "delete <name>",
	Short: "Delete an unused docker volume",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if !Confirm(fmt.Sprintf("Delete volume %s?", args[0])) {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		if _, err := c.Do("DELETE", "/admin/volumes/"+args[0], nil); err != nil {
			return err
		}
		if JSONMode() {
			return PrintJSON(map[string]string{"status": "deleted", "name": args[0]})
		}
		fmt.Printf("Deleted volume %s\n", args[0])
		return nil
	},
}

func init() {
	VolumesCmd.AddCommand(volumesListCmd, volumesDeleteCmd)
}
