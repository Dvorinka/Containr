package cli

import (
	"fmt"
	"os"

	"containr/internal/cli/commands"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var cfgFile string

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "containr",
	Short: "Containr CLI - Manage your self-hosted PaaS",
	Long: `Containr CLI is a command-line interface for managing your Containr platform.
You can manage projects, services, deployments, databases, and more from your terminal.`,
	Version: "1.0.0",
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	cobra.CheckErr(rootCmd.Execute())
}

func init() {
	cobra.OnInitialize(initConfig)

	// Global flags
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.containr.yaml)")
	rootCmd.PersistentFlags().String("api-url", "", "Containr API URL (default is https://api.containr.dev)")
	rootCmd.PersistentFlags().String("token", "", "Authentication token")

	// Bind flags to viper
	viper.BindPFlag("api-url", rootCmd.PersistentFlags().Lookup("api-url"))
	viper.BindPFlag("token", rootCmd.PersistentFlags().Lookup("token"))

	// Add command groups
	rootCmd.AddCommand(commands.AuthCmd)
	rootCmd.AddCommand(commands.ProjectsCmd)
}

// initConfig reads in config file and ENV variables if set.
func initConfig() {
	if cfgFile != "" {
		// Use config file from the flag.
		viper.SetConfigFile(cfgFile)
	} else {
		// Find home directory.
		home, err := os.UserHomeDir()
		cobra.CheckErr(err)

		// Search config in home directory with name ".containr" (without extension).
		viper.AddConfigPath(home)
		viper.SetConfigType("yaml")
		viper.SetConfigName(".containr")
	}

	viper.AutomaticEnv() // read in environment variables that match

	// If a config file is found, read it in.
	if err := viper.ReadInConfig(); err == nil {
		fmt.Fprintln(os.Stderr, "Using config file:", viper.ConfigFileUsed())
	}
}

// Run executes the CLI
func Run() error {
	rootCmd.Execute()
	return nil
}
