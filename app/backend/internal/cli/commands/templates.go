package commands

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

// TemplatesCmd manages the template catalog.
var TemplatesCmd = &cobra.Command{
	Use:     "templates",
	Aliases: []string{"template"},
	Short:   "Browse and deploy templates",
}

var templatesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List templates",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/templates", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "templates")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, t := range items {
			rows = append(rows, []string{
				str(t, "id"), str(t, "name"), str(t, "category"), str(t, "description"),
			})
		}
		printRows(data, []string{"ID", "NAME", "CATEGORY", "DESCRIPTION"}, rows)
		return nil
	},
}

var templatesGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Show a template definition",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/templates/"+args[0], nil)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var templatesCreateCmd = &cobra.Command{
	Use:   "create <file>",
	Short: "Create a user template from a JSON file",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		raw, err := os.ReadFile(args[0])
		if err != nil {
			return fmt.Errorf("cannot read %s: %w", args[0], err)
		}
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/templates", raw)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var templatesDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a user template",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if !Confirm(fmt.Sprintf("Delete template %s?", args[0])) {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		if _, err := c.Do("DELETE", "/templates/"+args[0], nil); err != nil {
			return err
		}
		if JSONMode() {
			return PrintJSON(map[string]string{"status": "deleted", "id": args[0]})
		}
		fmt.Printf("Deleted template %s\n", args[0])
		return nil
	},
}

var tplDeployVars []string
var tplDeployName string

var templatesDeployCmd = &cobra.Command{
	Use:   "deploy <template-id> <project-id>",
	Short: "Deploy a template into a project",
	Long:  "Deploys a single-service template or a multi-service graph (v2) template. Pass --name for single-service templates; graph members take names from the template. Use --var KEY=VALUE to override template variables.",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		body := map[string]interface{}{"project_id": args[1]}
		if tplDeployName != "" {
			body["name"] = tplDeployName
		}
		vars, err := parseKVFlags(tplDeployVars)
		if err != nil {
			return err
		}
		if len(vars) > 0 {
			body["variables"] = vars
		}
		data, err := c.Do("POST", "/templates/"+args[0]+"/deploy", body)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var templatesPlanCmd = &cobra.Command{
	Use:   "plan <template-id>",
	Short: "Dry-resolve a template — expanded expressions, service refs, missing variables",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		vars, err := parseKVFlags(tplDeployVars)
		if err != nil {
			return err
		}
		body := map[string]interface{}{}
		if len(vars) > 0 {
			body["variables"] = vars
		}
		data, err := c.Do("POST", "/templates/"+args[0]+"/plan", body)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var templatesImportComposeCmd = &cobra.Command{
	Use:   "import-compose <compose.yml|->",
	Short: "Convert a docker-compose file into a template graph config",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		var raw []byte
		var err error
		if args[0] == "-" {
			raw, err = io.ReadAll(os.Stdin)
		} else {
			raw, err = os.ReadFile(args[0])
		}
		if err != nil {
			return fmt.Errorf("cannot read compose file: %w", err)
		}
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/templates/import/compose", map[string]string{"compose_yaml": string(raw)})
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var templatesImportGitCmd = &cobra.Command{
	Use:   "import-git <repo> [path]",
	Short: "Fetch a compose file from a git repo and convert it into a template graph config",
	Long:  "repo accepts a clone URL, ssh remote, or owner/repo shorthand resolved via connected git providers (private repos included). path defaults to compose.yaml/yml or docker-compose.yml/yaml. --ref selects a branch or commit.",
	Args:  cobra.RangeArgs(1, 2),
	RunE: func(cmd *cobra.Command, args []string) error {
		body := map[string]string{"repo": args[0]}
		if len(args) > 1 {
			body["path"] = args[1]
		}
		if v, _ := cmd.Flags().GetString("ref"); v != "" {
			body["ref"] = v
		}
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/templates/import/git", body)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

var templatesDeployGraphCmd = &cobra.Command{
	Use:   "deploy-graph <project-id> <config.json|->",
	Short: "Deploy an ad-hoc service graph (v2 config with services[]) without a stored template",
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
			return fmt.Errorf("cannot read config: %w", err)
		}
		var config json.RawMessage
		if err := json.Unmarshal(raw, &config); err != nil {
			return fmt.Errorf("invalid config JSON: %w", err)
		}
		c, err := client()
		if err != nil {
			return err
		}
		vars, err := parseKVFlags(tplDeployVars)
		if err != nil {
			return err
		}
		body := map[string]interface{}{"project_id": args[0]}
		var cfg map[string]interface{}
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("invalid config JSON: %w", err)
		}
		body["config"] = cfg
		if len(vars) > 0 {
			body["variables"] = vars
		}
		data, err := c.Do("POST", "/templates/deploy", body)
		if err != nil {
			return err
		}
		PrintRaw(data)
		return nil
	},
}

// parseKVFlags converts repeated --var KEY=VALUE flags into a map.
func parseKVFlags(flags []string) (map[string]string, error) {
	out := map[string]string{}
	for _, f := range flags {
		idx := strings.Index(f, "=")
		if idx <= 0 {
			return nil, fmt.Errorf("invalid --var %q — expected KEY=VALUE", f)
		}
		out[f[:idx]] = f[idx+1:]
	}
	return out, nil
}

func init() {
	templatesDeployCmd.Flags().StringVar(&tplDeployName, "name", "", "Name for the created service (single-service templates)")
	templatesDeployCmd.Flags().StringArrayVar(&tplDeployVars, "var", nil, "Template variable override (KEY=VALUE, repeatable)")
	templatesPlanCmd.Flags().StringArrayVar(&tplDeployVars, "var", nil, "Template variable override (KEY=VALUE, repeatable)")
	templatesDeployGraphCmd.Flags().StringArrayVar(&tplDeployVars, "var", nil, "Template variable override (KEY=VALUE, repeatable)")
	templatesImportGitCmd.Flags().String("ref", "", "git branch or commit (default: remote HEAD)")
	TemplatesCmd.AddCommand(templatesListCmd, templatesGetCmd, templatesCreateCmd, templatesDeleteCmd, templatesDeployCmd, templatesPlanCmd, templatesImportComposeCmd, templatesImportGitCmd, templatesDeployGraphCmd)
}
