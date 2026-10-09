package cli

import (
	"fmt"
	"os"

	"containr/internal/cli/commands"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var cfgFile string

var rootCmd = &cobra.Command{
	Use:   "containr",
	Short: "Containr CLI - manage your self-hosted PaaS",
	Long: `Containr CLI controls every part of a Containr instance: projects,
services, deployments, databases, cron jobs, templates, nodes, scaling,
HA, security, and the API gateway.

Authenticate once with a personal access token (Settings → Personal
Access Tokens in the web UI):

  containr auth login cnp_...

Every command supports --json for machine-readable output, and
destructive actions accept --yes to skip confirmation.`,
	Version:       "2.0.0",
	SilenceUsage:  true,
	SilenceErrors: true,
}

// Execute runs the root command and returns the process exit code.
func Execute() int {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return commands.ExitCode(err)
	}
	return commands.ExitOK
}

// SetVersion overrides the version reported by `containr --version`.
func SetVersion(v string) {
	rootCmd.Version = v
}

func init() {
	cobra.OnInitialize(initConfig)

	pf := rootCmd.PersistentFlags()
	pf.StringVar(&cfgFile, "config", "", "config file (default $HOME/.containr.yaml)")
	pf.String("api-url", "", "Containr API URL (overrides profile and CONTAINR_API_URL)")
	pf.String("token", "", "auth token (overrides profile and CONTAINR_TOKEN)")
	pf.StringP("profile", "p", "", "config profile to use (default current_profile)")
	pf.Bool("json", false, "machine-readable JSON output")
	pf.BoolP("yes", "y", false, "skip confirmation prompts (required for destructive ops in scripts)")
	pf.String("idempotency-key", "", "Idempotency-Key header for POST mutations (safe retries)")

	viper.BindPFlag("api-url", pf.Lookup("api-url"))
	viper.BindPFlag("token", pf.Lookup("token"))
	viper.BindPFlag("profile", pf.Lookup("profile"))
	viper.BindPFlag("json", pf.Lookup("json"))
	viper.BindPFlag("yes", pf.Lookup("yes"))
	viper.BindPFlag("idempotency-key", pf.Lookup("idempotency-key"))

	rootCmd.AddCommand(commands.AuthCmd)
	rootCmd.AddCommand(commands.TokensCmd)
	rootCmd.AddCommand(commands.ProjectsCmd)
	rootCmd.AddCommand(commands.ServicesCmd)
	rootCmd.AddCommand(commands.DeployCmd)
	rootCmd.AddCommand(commands.DeploymentsCmd)
	rootCmd.AddCommand(commands.LogsCmd)
	rootCmd.AddCommand(commands.ExecCmd)
	rootCmd.AddCommand(commands.VariablesCmd)
	rootCmd.AddCommand(commands.VolumesCmd)
	rootCmd.AddCommand(commands.RegistriesCmd)
	rootCmd.AddCommand(commands.BackupTargetsCmd)
	rootCmd.AddCommand(commands.DatabasesCmd)
	rootCmd.AddCommand(commands.CronCmd)
	rootCmd.AddCommand(commands.TemplatesCmd)
	rootCmd.AddCommand(commands.ImportCmd)
	rootCmd.AddCommand(commands.NodesCmd)
	rootCmd.AddCommand(commands.ScalingCmd)
	rootCmd.AddCommand(commands.HACmd)
	rootCmd.AddCommand(commands.SecurityCmd)
	rootCmd.AddCommand(commands.GatewayCmd)
	rootCmd.AddCommand(commands.AdminCmd)
	rootCmd.AddCommand(commands.NotificationsCmd)
	rootCmd.AddCommand(commands.WebhooksCmd)
	rootCmd.AddCommand(commands.OperationsCmd)
	rootCmd.AddCommand(commands.ActivityCmd)
	rootCmd.AddCommand(commands.ShellCmd)
	rootCmd.AddCommand(commands.BannersCmd)
	rootCmd.AddCommand(commands.InvitesCmd)
	rootCmd.AddCommand(commands.UpCmd)
}

func initConfig() {
	if cfgFile != "" {
		viper.SetConfigFile(cfgFile)
	} else {
		home, err := os.UserHomeDir()
		cobra.CheckErr(err)
		viper.AddConfigPath(home)
		viper.SetConfigType("yaml")
		viper.SetConfigName(".containr")
	}
	viper.AutomaticEnv()
	// CONTAINR_TOKEN / CONTAINR_API_URL are read explicitly in config.go;
	// AutomaticEnv covers them only when bound, so this is belt-and-braces.
	viper.ReadInConfig()
}
