package commands

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

// dflow runs on Payload CMS — every collection is a plain REST resource under
// /api/<slug> returning {docs, page, totalPages, hasNextPage}. Auth is a
// Payload API key on the users collection: "Authorization: users API-Key <k>".

type dflowServicePlan struct {
	ID          string
	Name        string
	Description string
	Type        string // web | database
	Image       string
	GitRepo     string
	GitBranch   string
	BuildPath   string
	Port        int
	Variables   map[string]string
	Domains     []string
	Volumes     []map[string]string
}

var migrateDflowCmd = &cobra.Command{
	Use:   "dflow",
	Short: "Migrate a dflow (Payload CMS) project into Containr",
	Long: `Pulls a dflow project's services, variables, volumes, and domains via the
Payload REST API and recreates them in Containr.

  containr migrate dflow --url https://dflow.example.com --api-key <key> --dry-run
  containr migrate dflow --url https://dflow.example.com --api-key <key> --project <id>

Auth: a Payload API key from a dflow admin user (users API-Key). Encrypted
fields (variables, git tokens) only come back decrypted if the API key belongs
to a user with access — empty values are flagged so nothing is silently lost.`,
	Args: cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		base, _ := cmd.Flags().GetString("url")
		if base == "" {
			base = os.Getenv("DFLOW_URL")
		}
		if base == "" {
			return &APIError{Message: "pass --url or set DFLOW_URL", ExitCode: ExitError}
		}
		base = strings.TrimSuffix(base, "/")
		key, _ := cmd.Flags().GetString("api-key")
		if key == "" {
			key = os.Getenv("DFLOW_API_KEY")
		}
		if key == "" {
			return &APIError{Message: "pass --api-key or set DFLOW_API_KEY", ExitCode: ExitError}
		}
		projectID, _ := cmd.Flags().GetString("project")
		into, _ := cmd.Flags().GetString("into")
		dryRun, _ := cmd.Flags().GetBool("dry-run")

		projectName, services, err := dflowProject(base, key, projectID)
		if err != nil {
			return err
		}
		if len(services) == 0 {
			return &APIError{Message: "no services found in that dflow project", ExitCode: ExitError}
		}

		plans := make([]dflowServicePlan, 0, len(services))
		for _, svc := range services {
			plan, warn := dflowServicePlanOf(svc)
			for _, w := range warn {
				fmt.Fprintf(os.Stderr, "  warning: %s: %s\n", plan.Name, w)
			}
			plans = append(plans, plan)
		}

		fmt.Printf("dflow project %q → %d service(s)\n", projectName, len(plans))
		for _, p := range plans {
			src := p.Image
			if src == "" {
				src = p.GitRepo
			}
			fmt.Printf("  %s  type=%s src=%s vars=%d domains=%d volumes=%d\n",
				p.Name, p.Type, src, len(p.Variables), len(p.Domains), len(p.Volumes))
		}

		if dryRun {
			fmt.Println("\nDry run — pass without --dry-run to create these resources.")
			return nil
		}

		c, err := client()
		if err != nil {
			return err
		}

		target := into
		if target == "" {
			data, err := c.Do("POST", "/projects", map[string]interface{}{
				"name":        projectName,
				"description": "Imported from dflow",
			})
			if err != nil {
				return err
			}
			p, _ := unwrapObject(data, "project")
			target = str(p, "id")
			if target == "" || target == "-" {
				return &APIError{Message: "project created but id missing from response", ExitCode: ExitError}
			}
			fmt.Printf("Created project %s (%s)\n", projectName, target)
		}

		for _, p := range plans {
			body := map[string]interface{}{
				"name":        p.Name,
				"type":        p.Type,
				"environment": "production",
			}
			if p.Image != "" {
				body["image"] = p.Image
			}
			if p.GitRepo != "" {
				body["git_repo"] = p.GitRepo
			}
			if p.GitBranch != "" {
				body["git_branch"] = p.GitBranch
			}
			if p.BuildPath != "" {
				body["build_path"] = p.BuildPath
			}
			if p.Port > 0 {
				body["port"] = p.Port
			}
			if len(p.Volumes) > 0 {
				vols := make([]map[string]interface{}, 0, len(p.Volumes))
				for _, v := range p.Volumes {
					vols = append(vols, map[string]interface{}{
						"type": "bind", "source": v["source"], "target": v["target"],
					})
				}
				body["volumes"] = vols
			}
			data, err := c.Do("POST", "/projects/"+target+"/services", body)
			if err != nil {
				fmt.Fprintf(os.Stderr, "error: create %s: %v\n", p.Name, err)
				continue
			}
			svc, _ := unwrapObject(data, "service")
			svcID := str(svc, "id")
			fmt.Printf("  created service %s (%s)\n", p.Name, svcID)

			if len(p.Variables) > 0 && svcID != "" && svcID != "-" {
				vars := make([]map[string]interface{}, 0, len(p.Variables))
				for k, v := range p.Variables {
					vars = append(vars, map[string]interface{}{"key": k, "value": v, "is_secret": false})
				}
				if _, err := c.Do("PUT", "/services/"+svcID+"/variables",
					map[string]interface{}{"variables": vars}); err != nil {
					fmt.Fprintf(os.Stderr, "  warning: variables for %s: %v\n", p.Name, err)
				}
			}
			for _, domain := range p.Domains {
				if svcID == "" || svcID == "-" {
					break
				}
				if _, err := c.Do("POST", "/services/"+svcID+"/domains",
					map[string]interface{}{"domain": domain}); err != nil {
					fmt.Fprintf(os.Stderr, "  warning: domain %s: %v\n", domain, err)
				}
			}
		}
		fmt.Println("Done. Git credentials, deployment history, and server topology are not migrated — reconnect repos and redeploy each service when ready.")
		return nil
	},
}

// dflowGet performs an authenticated Payload REST call.
func dflowGet(base, apiKey, path string, q url.Values) (map[string]interface{}, error) {
	u := base + "/api/" + path
	if len(q) > 0 {
		u += "?" + q.Encode()
	}
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "users API-Key "+apiKey)
	req.Header.Set("Accept", "application/json")
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, &APIError{Message: "dflow rejected the API key — needs an admin user's users API-Key", ExitCode: ExitAuth}
	}
	var out map[string]interface{}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("dflow response not JSON (status %d)", resp.StatusCode)
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("dflow status %d", resp.StatusCode)
	}
	return out, nil
}

// dflowCollection pages through a Payload collection.
func dflowCollection(base, apiKey, collection string, q url.Values) ([]map[string]interface{}, error) {
	var docs []map[string]interface{}
	for page := 1; ; page++ {
		params := url.Values{}
		for k, v := range q {
			params[k] = v
		}
		params.Set("limit", "100")
		params.Set("depth", "0")
		params.Set("page", fmt.Sprint(page))
		data, err := dflowGet(base, apiKey, collection, params)
		if err != nil {
			return nil, err
		}
		list, _ := data["docs"].([]interface{})
		for _, d := range list {
			if m, ok := d.(map[string]interface{}); ok {
				docs = append(docs, m)
			}
		}
		next, _ := data["hasNextPage"].(bool)
		if !next {
			return docs, nil
		}
	}
}

// dflowProject resolves the project (by id, or sole project) and returns its
// name plus its services.
func dflowProject(base, apiKey, projectID string) (string, []map[string]interface{}, error) {
	if projectID == "" {
		projects, err := dflowCollection(base, apiKey, "projects", nil)
		if err != nil {
			return "", nil, err
		}
		if len(projects) == 1 {
			projectID = str(projects[0], "id")
		} else {
			for _, p := range projects {
				fmt.Fprintf(os.Stderr, "  %s  %s\n", str(p, "id"), str(p, "name"))
			}
			return "", nil, &APIError{
				Message:  "multiple projects — pass --project <id> (listed above)",
				ExitCode: ExitError,
			}
		}
	}

	projects, err := dflowCollection(base, apiKey, "projects",
		url.Values{"where[id][equals]": {projectID}})
	if err != nil {
		return "", nil, err
	}
	if len(projects) == 0 {
		return "", nil, &APIError{Message: "dflow project not found", ExitCode: ExitNotFound}
	}
	name := str(projects[0], "name")

	q := url.Values{
		"where[project][equals]":     {projectID},
		"where[deletedAt][exists]":   {"false"},
		"where[_status][not_equals]": {"draft"},
	}
	services, err := dflowCollection(base, apiKey, "services", q)
	if err != nil {
		return "", nil, err
	}
	return name, services, nil
}

// dflowServicePlanOf maps a Payload service doc onto a Containr create plan.
func dflowServicePlanOf(svc map[string]interface{}) (dflowServicePlan, []string) {
	var warn []string
	plan := dflowServicePlan{
		ID:          str(svc, "id"),
		Name:        str(svc, "name"),
		Description: str(svc, "description"),
		Variables:   map[string]string{},
	}
	switch str(svc, "type") {
	case "app":
		plan.Type = "web"
		settings := dflowProviderSettings(svc)
		plan.GitRepo = dflowRepoURL(str(svc, "providerType"), str(settings, "owner"), str(settings, "repository"))
		plan.GitBranch = str(settings, "branch")
		plan.BuildPath = str(settings, "buildPath")
		plan.Port = int(num(settings, "port"))
		if plan.GitRepo == "" {
			warn = append(warn, "no repository settings — importing with no source")
		}
	case "docker":
		plan.Type = "web"
		d, _ := svc["dockerDetails"].(map[string]interface{})
		plan.Image = normalizeDockerImage(str(d, "url"))
		for _, p := range listOf(d, "ports") {
			if plan.Port == 0 {
				plan.Port = int(num(p, "containerPort"))
			}
		}
		if plan.Image == "" {
			warn = append(warn, "no docker image url — importing with no source")
		}
	case "database":
		plan.Type = "database"
		d, _ := svc["databaseDetails"].(map[string]interface{})
		dbType := str(d, "type")
		version := str(d, "version")
		if dbType != "" {
			plan.Image = dbType + ":" + firstOf(version, "latest")
		}
		if str(d, "provider") == "external" {
			if conn := str(d, "connectionUrl"); conn != "" {
				plan.Variables["DATABASE_URL"] = conn
			} else if str(d, "host") != "" {
				warn = append(warn, "external database has host but no connectionUrl — set DATABASE_URL manually")
			}
		}
	default:
		plan.Type = "web"
		warn = append(warn, fmt.Sprintf("unknown type %q — imported as web", str(svc, "type")))
	}

	for _, v := range listOf(svc, "variables") {
		k, val := str(v, "key"), str(v, "value")
		if k == "" {
			continue
		}
		if val == "" {
			warn = append(warn, fmt.Sprintf("variable %s came back empty (encrypted field?)", k))
		}
		plan.Variables[k] = val
	}
	for _, d := range listOf(svc, "domains") {
		if dom := str(d, "domain"); dom != "" && dom != "-" {
			plan.Domains = append(plan.Domains, dom)
		}
	}
	for _, v := range listOf(svc, "volumes") {
		host, container := str(v, "hostPath"), str(v, "containerPath")
		if host != "" && container != "" {
			plan.Volumes = append(plan.Volumes, map[string]string{"source": host, "target": container})
		}
	}
	return plan, warn
}

// dflowProviderSettings picks the populated <provider>Settings group.
func dflowProviderSettings(svc map[string]interface{}) map[string]interface{} {
	for _, key := range []string{"githubSettings", "gitlabSettings", "bitbucketSettings", "giteaSettings", "azureSettings"} {
		if g, ok := svc[key].(map[string]interface{}); ok && str(g, "repository") != "" {
			return g
		}
	}
	return nil
}

// dflowRepoURL builds a cloneable https URL for the known git providers.
func dflowRepoURL(providerType, owner, repo string) string {
	repo = strings.TrimSuffix(strings.TrimSpace(repo), ".git")
	owner = strings.TrimSpace(owner)
	if repo == "" {
		return ""
	}
	if strings.Contains(repo, "://") || strings.HasPrefix(repo, "git@") {
		return repo
	}
	switch providerType {
	case "gitlab":
		return "https://gitlab.com/" + owner + "/" + repo
	case "bitbucket":
		return "https://bitbucket.org/" + owner + "/" + repo
	case "azureDevOps":
		return "https://dev.azure.com/" + owner + "/_git/" + repo
	case "gitea":
		return "" // host unknown — user must reconnect the repo
	default:
		if owner == "" {
			return ""
		}
		return "https://github.com/" + owner + "/" + repo
	}
}

// normalizeDockerImage fixes common dflow registry URL typos (ghrc://).
func normalizeDockerImage(image string) string {
	image = strings.TrimSpace(image)
	if strings.HasPrefix(image, "ghrc://") {
		return "ghcr.io/" + strings.TrimPrefix(image, "ghrc://")
	}
	return image
}

func listOf(m map[string]interface{}, key string) []map[string]interface{} {
	raw, _ := m[key].([]interface{})
	out := make([]map[string]interface{}, 0, len(raw))
	for _, item := range raw {
		if v, ok := item.(map[string]interface{}); ok {
			out = append(out, v)
		}
	}
	return out
}

func num(m map[string]interface{}, key string) float64 {
	v, _ := m[key].(float64)
	return v
}

func firstOf(v, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}

func init() {
	migrateDflowCmd.Flags().String("url", "", "dflow base URL (or DFLOW_URL env)")
	migrateDflowCmd.Flags().String("api-key", "", "dflow admin API key (or DFLOW_API_KEY env)")
	migrateDflowCmd.Flags().String("project", "", "dflow project id (lists yours when omitted and >1 exists)")
	migrateDflowCmd.Flags().String("into", "", "existing Containr project id (default: create one)")
	migrateDflowCmd.Flags().Bool("dry-run", false, "print the plan without creating anything")
	MigrateCmd.AddCommand(migrateDflowCmd)
}
