package commands

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// UpCmd deploys the current directory: resolves a project, creates (or
// reuses) a service named after the directory, and triggers a deployment.
// The git remote URL and current branch become the build source.
var UpCmd = &cobra.Command{
	Use:   "up",
	Short: "Deploy the current directory (create service + deploy)",
	Long: `Deploy the current directory to Containr.

The git remote and current branch are used as the build source. If no
service named after this directory exists in the project, one is
created; an existing service is redeployed.`,
	RunE: runUp,
}

func runUp(cmd *cobra.Command, args []string) error {
	c, err := client()
	if err != nil {
		return err
	}

	projectID, _ := cmd.Flags().GetString("project")
	if projectID == "" {
		projectID = viper.GetString("profiles." + ActiveProfile() + ".project_id")
	}
	if projectID == "" {
		return &APIError{
			Message:  "no project selected — pass --project <id> or set project_id on the active profile",
			ExitCode: ExitValidation,
		}
	}

	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	name, _ := cmd.Flags().GetString("name")
	if name == "" {
		name = filepath.Base(cwd)
	}
	repo := gitOutput(cwd, "config", "--get", "remote.origin.url")
	branch := gitOutput(cwd, "rev-parse", "--abbrev-ref", "HEAD")
	commit := gitOutput(cwd, "rev-parse", "HEAD")
	image, _ := cmd.Flags().GetString("image")

	if repo == "" && image == "" {
		return &APIError{
			Message:  "no git remote and no --image — either init git with an origin remote or pass --image",
			ExitCode: ExitValidation,
		}
	}

	// Reuse an existing same-named service when present.
	svcID, _ := cmd.Flags().GetString("service")
	if svcID == "" {
		if data, err := c.Do("GET", "/projects/"+projectID+"/services", nil); err == nil {
			if items, err := unwrapList(data, "services"); err == nil {
				for _, s := range items {
					if str(s, "name") == name {
						svcID = str(s, "id")
						break
					}
				}
			}
		}
	}

	if svcID == "" {
		body := map[string]interface{}{
			"name":        name,
			"type":        "web",
			"environment": "production",
		}
		if repo != "" {
			body["git_repo"] = repo
			if branch != "" {
				body["git_branch"] = branch
			}
		}
		if image != "" {
			body["image"] = image
		}
		data, err := c.Do("POST", "/projects/"+projectID+"/services", body)
		if err != nil {
			return err
		}
		s, _ := unwrapObject(data, "service")
		svcID = str(s, "id")
		if svcID == "" || svcID == "-" {
			PrintRaw(data)
			return &APIError{Message: "service created but id missing from response", ExitCode: ExitError}
		}
		if !JSONMode() {
			fmt.Fprintf(os.Stderr, "Created service %s (%s)\n", name, svcID)
		}
	}

	deployBody := map[string]interface{}{"trigger": "cli-up"}
	if commit != "" {
		deployBody["commit_hash"] = commit
	}
	if branch != "" {
		deployBody["branch"] = branch
	}
	data, err := c.Do("POST", "/services/"+svcID+"/deployments", deployBody)
	if err != nil {
		return err
	}
	if JSONMode() {
		PrintRaw(data)
		return nil
	}
	d, _ := unwrapObject(data, "deployment")
	fmt.Printf("Deploying %s → service %s (deployment %s)\n", name, svcID, str(d, "id"))
	return nil
}

func gitOutput(dir string, args ...string) string {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func init() {
	UpCmd.Flags().String("project", "", "target project id (or set project_id on the profile)")
	UpCmd.Flags().String("name", "", "service name (default: directory name)")
	UpCmd.Flags().String("service", "", "existing service id to redeploy")
	UpCmd.Flags().String("image", "", "deploy this image instead of building from git")
}
