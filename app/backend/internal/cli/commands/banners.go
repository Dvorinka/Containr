package commands

import (
	"fmt"

	"github.com/spf13/cobra"
)

var (
	bannerTitle  string
	bannerLevel  string
	bannerBody   string
	bannerActive bool
)

// BannersCmd manages instance-wide announcement banners (admin).
var BannersCmd = &cobra.Command{
	Use:   "banners",
	Short: "Manage announcement banners (admin)",
}

var bannerListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all banners",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/admin/banners", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "banners")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, b := range items {
			rows = append(rows, []string{
				str(b, "id"), str(b, "title"), str(b, "level"), str(b, "active"),
			})
		}
		printRows(data, []string{"ID", "TITLE", "LEVEL", "ACTIVE"}, rows)
		return nil
	},
}

var bannerCreateCmd = &cobra.Command{
	Use:   "create <title>",
	Short: "Create a banner (--body --level info|success|warning|error)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		req := map[string]interface{}{"title": args[0]}
		if cmd.Flags().Changed("body") {
			req["body"] = bannerBody
		}
		if cmd.Flags().Changed("level") {
			req["level"] = bannerLevel
		}
		data, err := c.Do("POST", "/admin/banners", req)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var bannerUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update a banner (--title --body --level --active/--inactive)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		req := map[string]interface{}{}
		if cmd.Flags().Changed("title") {
			req["title"] = bannerTitle
		}
		if cmd.Flags().Changed("body") {
			req["body"] = bannerBody
		}
		if cmd.Flags().Changed("level") {
			req["level"] = bannerLevel
		}
		if cmd.Flags().Changed("active") {
			req["active"] = bannerActive
		}
		if len(req) == 0 {
			return fmt.Errorf("nothing to update — pass --title/--body/--level/--active")
		}
		data, err := c.Do("PATCH", "/admin/banners/"+args[0], req)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var bannerDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a banner",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if !Confirm("Delete banner " + args[0] + "?") {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		c, err := client()
		if err != nil {
			return err
		}
		_, err = c.Do("DELETE", "/admin/banners/"+args[0], nil)
		return err
	},
}

func init() {
	bannerCreateCmd.Flags().StringVar(&bannerBody, "body", "", "banner body text")
	bannerCreateCmd.Flags().StringVar(&bannerLevel, "level", "info", "info|success|warning|error")
	bannerUpdateCmd.Flags().StringVar(&bannerTitle, "title", "", "new title")
	bannerUpdateCmd.Flags().StringVar(&bannerBody, "body", "", "new body")
	bannerUpdateCmd.Flags().StringVar(&bannerLevel, "level", "", "info|success|warning|error")
	bannerUpdateCmd.Flags().BoolVar(&bannerActive, "active", true, "set banner active/inactive")
	BannersCmd.AddCommand(bannerListCmd, bannerCreateCmd, bannerUpdateCmd, bannerDeleteCmd)
}
