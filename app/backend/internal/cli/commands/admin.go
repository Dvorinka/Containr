package commands

import (
	"fmt"

	"github.com/spf13/cobra"
)

// AdminCmd groups platform-admin operations.
var AdminCmd = &cobra.Command{
	Use:   "admin",
	Short: "Platform administration (admin scope required)",
}

var adminOverviewCmd = &cobra.Command{
	Use:   "overview",
	Short: "Platform overview",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/admin/overview", nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var adminUsersCmd = &cobra.Command{
	Use:   "users",
	Short: "List all users",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/admin/users", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "users")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, u := range items {
			rows = append(rows, []string{
				str(u, "id"), str(u, "email"), str(u, "name"), str(u, "is_admin"), relTime(u, "created_at"),
			})
		}
		printRows(data, []string{"ID", "EMAIL", "NAME", "ADMIN", "CREATED"}, rows)
		return nil
	},
}

var adminImpersonateCmd = &cobra.Command{
	Use:   "impersonate <user-id>",
	Short: "Mint a 15-minute token acting as a user (audit-logged)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/admin/users/"+args[0]+"/impersonate", map[string]interface{}{})
		if err != nil {
			return err
		}
		PrintRaw(data)
		fmt.Fprintln(cmd.ErrOrStderr(), "\nUse it with: CONTAINR_TOKEN=<token> containr <command>")
		return nil
	},
}

var adminGitHubAppCmd = &cobra.Command{
	Use:   "github-app",
	Short: "GitHub App self-provisioning",
}

var adminGitHubAppStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show GitHub App provisioning status",
	RunE:  simpleGet("/admin/git/github-app"),
}

var adminGitHubAppManifestCmd = &cobra.Command{
	Use:   "manifest",
	Short: "Build the manifest to create the instance GitHub App",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		req := map[string]interface{}{"base_url": ghAppBaseURL}
		if ghAppOrg != "" {
			req["organization"] = ghAppOrg
		}
		if ghAppName != "" {
			req["name"] = ghAppName
		}
		data, err := c.Do("POST", "/admin/git/github-app/manifest", req)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var adminGitHubAppConvertCmd = &cobra.Command{
	Use:   "convert <code>",
	Short: "Exchange the manifest callback code for app credentials",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/admin/git/github-app/convert", map[string]interface{}{"code": args[0]})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var (
	ghAppBaseURL string
	ghAppOrg     string
	ghAppName    string
)

var adminSettingsCmd = &cobra.Command{
	Use:   "settings",
	Short: "Show platform settings",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/settings", nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var adminAuditCmd = &cobra.Command{
	Use:   "audit-logs",
	Short: "List audit log entries",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/audit-logs", nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

// GatewayCmd manages the API gateway (admin).
var GatewayCmd = &cobra.Command{
	Use:   "gateway",
	Short: "Manage the API gateway (admin)",
}

var gatewayServicesCmd = &cobra.Command{
	Use:   "services",
	Short: "List gateway services",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/gateway/services", nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var gatewayKeysCmd = &cobra.Command{
	Use:   "keys",
	Short: "List gateway API keys",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/gateway/keys", nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var gatewayAnalyticsCmd = &cobra.Command{
	Use:   "analytics",
	Short: "Gateway traffic analytics",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		kind, _ := cmd.Flags().GetString("type")
		data, err := c.Do("GET", "/gateway/analytics/"+kind, nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

// HACmd manages high availability.
var HACmd = &cobra.Command{
	Use:   "ha",
	Short: "High availability controls",
}

var haStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show HA status",
	RunE:  simpleGet("/ha/status"),
}

var haAlertsCmd = &cobra.Command{
	Use:   "alerts",
	Short: "List active HA alerts",
	RunE:  simpleGet("/ha/alerts/active"),
}

var haHealthCmd = &cobra.Command{
	Use:   "health",
	Short: "List health check results",
	RunE:  simpleGet("/ha/health/results"),
}

var haPoliciesCmd = &cobra.Command{
	Use:   "policies",
	Short: "List failover policies",
	RunE:  simpleGet("/ha/failover/policies"),
}

var haEnableCmd = &cobra.Command{
	Use:   "enable",
	Short: "Enable the HA manager",
	RunE:  simplePost("/ha/enable"),
}

var haDisableCmd = &cobra.Command{
	Use:   "disable",
	Short: "Disable the HA manager",
	RunE: func(cmd *cobra.Command, args []string) error {
		if !Confirm("Disable HA? Services will no longer be failed over.") {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		return simplePost("/ha/disable")(cmd, args)
	},
}

var haFailoverCmd = &cobra.Command{
	Use:   "failover",
	Short: "Trigger a manual failover",
	RunE: func(cmd *cobra.Command, args []string) error {
		if !Confirm("Trigger a platform failover now? Services may be rescheduled.") {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		return simplePost("/ha/failover")(cmd, args)
	},
}

// ScalingCmd manages autoscaling.
var ScalingCmd = &cobra.Command{
	Use:   "scaling",
	Short: "Autoscaling controls",
}

var scalingStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show autoscaler status",
	RunE:  simpleGet("/scaling/status"),
}

var scalingPoliciesCmd = &cobra.Command{
	Use:   "policies",
	Short: "List scaling policies",
	RunE:  simpleGet("/scaling/policies"),
}

var scalingServicesCmd = &cobra.Command{
	Use:   "services",
	Short: "Show per-service scaling state",
	RunE:  simpleGet("/scaling/services"),
}

var scalingScaleCmd = &cobra.Command{
	Use:   "scale <service-id> <replicas>",
	Short: "Manually scale a service",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		var replicas int
		fmt.Sscanf(args[1], "%d", &replicas)
		data, err := c.Do("POST", "/scaling/services/"+args[0]+"/scale", map[string]int{"replicas": replicas})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

// SecurityCmd manages security scans and findings.
var SecurityCmd = &cobra.Command{
	Use:   "security",
	Short: "Security scans and vulnerabilities",
}

var securityScanCmd = &cobra.Command{
	Use:   "scan <project-id>",
	Short: "Run a security scan",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		scanType, _ := cmd.Flags().GetString("type")
		serviceID, _ := cmd.Flags().GetString("service")
		body := map[string]interface{}{"project_id": args[0], "scan_type": scanType}
		if serviceID != "" {
			body["service_id"] = serviceID
		}
		data, err := c.Do("POST", "/security/scans", body)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var securityVulnsCmd = &cobra.Command{
	Use:   "vulnerabilities <project-id>",
	Short: "List a project's vulnerabilities",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/projects/"+args[0]+"/vulnerabilities", nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var securityMetricsCmd = &cobra.Command{
	Use:   "metrics <project-id>",
	Short: "Show a project's security metrics",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/projects/"+args[0]+"/security/metrics", nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

// simpleGet/simplePost cover the many read/trigger endpoints whose full
// JSON response is the useful output.
func simpleGet(path string) func(*cobra.Command, []string) error {
	return func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", path, nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	}
}

func simplePost(path string) func(*cobra.Command, []string) error {
	return func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", path, map[string]interface{}{})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	}
}

func init() {
	gatewayAnalyticsCmd.Flags().String("type", "traffic", "traffic|ops")
	securityScanCmd.Flags().String("type", "configuration", "dependency|configuration|comprehensive")
	securityScanCmd.Flags().String("service", "", "limit scan to one service")

	adminGitHubAppManifestCmd.Flags().StringVar(&ghAppBaseURL, "base-url", "", "public base URL of this instance (required)")
	adminGitHubAppManifestCmd.Flags().StringVar(&ghAppOrg, "org", "", "create the app under this organization")
	adminGitHubAppManifestCmd.Flags().StringVar(&ghAppName, "name", "", "app name (defaults to product name + date)")
	adminGitHubAppManifestCmd.MarkFlagRequired("base-url")

	adminGitHubAppCmd.AddCommand(adminGitHubAppStatusCmd, adminGitHubAppManifestCmd, adminGitHubAppConvertCmd)
	AdminCmd.AddCommand(adminOverviewCmd, adminUsersCmd, adminSettingsCmd, adminAuditCmd, adminImpersonateCmd, adminGitHubAppCmd)
	GatewayCmd.AddCommand(gatewayServicesCmd, gatewayKeysCmd, gatewayAnalyticsCmd)
	HACmd.AddCommand(haStatusCmd, haAlertsCmd, haHealthCmd, haPoliciesCmd, haEnableCmd, haDisableCmd, haFailoverCmd)
	ScalingCmd.AddCommand(scalingStatusCmd, scalingPoliciesCmd, scalingServicesCmd, scalingScaleCmd)
	SecurityCmd.AddCommand(securityScanCmd, securityVulnsCmd, securityMetricsCmd)
}
