package commands

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

var webhookEvents []string
var webhookHeaders []string
var webhookSecret string
var webhookName string

// WebhooksCmd manages outbound webhooks — signed HTTP event delivery.
var WebhooksCmd = &cobra.Command{
	Use:     "webhooks",
	Aliases: []string{"hooks"},
	Short:   "Manage outbound webhooks (signed event delivery)",
}

var webhookListCmd = &cobra.Command{
	Use:   "list",
	Short: "List webhooks",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/webhooks", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "webhooks")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, w := range items {
			events := ""
			if ev, ok := w["events"].([]interface{}); ok {
				names := make([]string, 0, len(ev))
				for _, e := range ev {
					if s, ok := e.(string); ok {
						names = append(names, s)
					}
				}
				events = strings.Join(names, ",")
			}
			rows = append(rows, []string{
				str(w, "id"), str(w, "name"), str(w, "url"), events, str(w, "enabled"),
			})
		}
		printRows(data, []string{"ID", "NAME", "URL", "EVENTS", "ENABLED"}, rows)
		return nil
	},
}

func webhookBody(req map[string]interface{}) (map[string]interface{}, error) {
	if len(webhookEvents) > 0 {
		req["events"] = webhookEvents
	}
	if webhookSecret != "" {
		req["secret"] = webhookSecret
	}
	if webhookName != "" {
		req["name"] = webhookName
	}
	if len(webhookHeaders) > 0 {
		hdrs, err := parseKVFlags(webhookHeaders)
		if err != nil {
			return nil, err
		}
		req["headers"] = hdrs
	}
	return req, nil
}

var webhookCreateCmd = &cobra.Command{
	Use:   "create <name> <url>",
	Short: "Create a webhook (events repeat with --event; use \"*\" for all)",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		if len(webhookEvents) == 0 {
			return fmt.Errorf("at least one --event is required (e.g. --event 'service.*' or --event '*')")
		}
		c, err := client()
		if err != nil {
			return err
		}
		body, err := webhookBody(map[string]interface{}{"name": args[0], "url": args[1]})
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/webhooks", body)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var webhookUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update a webhook (--name --url --event --secret --header --enabled/--disabled)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		body, err := webhookBody(map[string]interface{}{})
		if err != nil {
			return err
		}
		if url, _ := cmd.Flags().GetString("url"); url != "" {
			body["url"] = url
		}
		if cmd.Flags().Changed("enabled") {
			body["enabled"] = true
		}
		if cmd.Flags().Changed("disabled") {
			body["enabled"] = false
		}
		data, err := c.Do("PATCH", "/webhooks/"+args[0], body)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var webhookDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a webhook",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if !Confirm("Delete webhook " + args[0] + "?") {
			return nil
		}
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("DELETE", "/webhooks/"+args[0], nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var webhookDeliveriesCmd = &cobra.Command{
	Use:   "deliveries <id>",
	Short: "Show recent delivery attempts for a webhook",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/webhooks/"+args[0]+"/deliveries", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "deliveries")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, d := range items {
			rows = append(rows, []string{
				str(d, "id"), str(d, "event"), str(d, "status"),
				str(d, "response_status"), str(d, "attempts"), relTime(d, "created_at"),
			})
		}
		printRows(data, []string{"ID", "EVENT", "STATUS", "HTTP", "TRIES", "AGE"}, rows)
		return nil
	},
}

var webhookTestCmd = &cobra.Command{
	Use:   "test <id>",
	Short: "Queue a test ping delivery",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/webhooks/"+args[0]+"/test", map[string]interface{}{})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

func init() {
	webhookCreateCmd.Flags().StringArrayVar(&webhookEvents, "event", nil, "Event subscription (e.g. 'service.*', 'deployment.fail', '*'; repeatable)")
	webhookCreateCmd.Flags().StringVar(&webhookSecret, "secret", "", "Signing secret (auto-generated when omitted)")
	webhookCreateCmd.Flags().StringArrayVar(&webhookHeaders, "header", nil, "Extra request header KEY=VALUE (repeatable)")
	webhookUpdateCmd.Flags().StringVar(&webhookName, "name", "", "New name")
	webhookUpdateCmd.Flags().String("url", "", "New URL")
	webhookUpdateCmd.Flags().StringArrayVar(&webhookEvents, "event", nil, "Replace event subscriptions (repeatable)")
	webhookUpdateCmd.Flags().StringVar(&webhookSecret, "secret", "", "New signing secret")
	webhookUpdateCmd.Flags().StringArrayVar(&webhookHeaders, "header", nil, "Replace request headers KEY=VALUE (repeatable)")
	webhookUpdateCmd.Flags().Bool("enabled", false, "Enable the webhook")
	webhookUpdateCmd.Flags().Bool("disabled", false, "Disable the webhook")

	WebhooksCmd.AddCommand(webhookListCmd, webhookCreateCmd, webhookUpdateCmd, webhookDeleteCmd, webhookDeliveriesCmd, webhookTestCmd)
}
