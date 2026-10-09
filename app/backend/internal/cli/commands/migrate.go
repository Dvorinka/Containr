package commands

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

const railwayAPI = "https://backboard.railway.com/graphql/v2"

// railwaySource mirrors the Railway serviceInstance.source union.
type railwaySource struct {
	Repo  string `json:"repo"`
	Image string `json:"image"`
}

type railwayServicePlan struct {
	ID        string
	Name      string
	Source    railwaySource
	Command   string
	Replicas  int
	Domains   []string
	Variables map[string]string
}

// MigrateCmd imports workloads from other platforms.
var MigrateCmd = &cobra.Command{
	Use:   "migrate",
	Short: "Import workloads from other platforms",
}

var migrateRailwayCmd = &cobra.Command{
	Use:   "railway",
	Short: "Migrate a Railway project into Containr",
	Long: `Pulls a Railway project's services, variables, and domains via the
public GraphQL API and recreates them in Containr.

  containr migrate railway --token <railway-token> --project <id> --dry-run
  containr migrate railway --token <railway-token> --project <id> --into <project-id>

Token: account/workspace token (Authorization: Bearer) or a project token.
--into defaults to creating a project named after the Railway project.`,
	Args: cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		token, _ := cmd.Flags().GetString("token")
		if token == "" {
			token = os.Getenv("RAILWAY_TOKEN")
		}
		if token == "" {
			return &APIError{Message: "pass --token or set RAILWAY_TOKEN", ExitCode: ExitError}
		}
		projectID, _ := cmd.Flags().GetString("project")
		envName, _ := cmd.Flags().GetString("environment")
		into, _ := cmd.Flags().GetString("into")
		dryRun, _ := cmd.Flags().GetBool("dry-run")

		projectName, envID, services, err := railwayProject(projectID, envName, token)
		if err != nil {
			return err
		}
		if len(services) == 0 {
			return &APIError{Message: "no services found in that Railway project/environment", ExitCode: ExitError}
		}

		plans := make([]railwayServicePlan, 0, len(services))
		for _, svc := range services {
			plan, err := railwayServiceDetail(svc, envID, token)
			if err != nil {
				fmt.Fprintf(os.Stderr, "warning: %s: %v — skipping\n", svc["name"], err)
				continue
			}
			plans = append(plans, plan)
		}
		if len(plans) == 0 {
			return &APIError{Message: "no migratable services", ExitCode: ExitError}
		}

		fmt.Printf("Railway project %q → %d service(s)\n", projectName, len(plans))
		for _, p := range plans {
			src := p.Source.Image
			if src == "" {
				src = railwayRepoURL(p.Source.Repo)
			}
			fmt.Printf("  %s  src=%s replicas=%d vars=%d domains=%d\n",
				p.Name, src, max(p.Replicas, 1), len(p.Variables), len(p.Domains))
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
				"description": "Imported from Railway",
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
				"type":        "web",
				"environment": "production",
			}
			if p.Source.Image != "" {
				body["image"] = p.Source.Image
			} else if repo := railwayRepoURL(p.Source.Repo); repo != "" {
				body["git_repo"] = repo
			} else {
				fmt.Fprintf(os.Stderr, "warning: %s has no source — skipping\n", p.Name)
				continue
			}
			if p.Command != "" {
				body["command"] = p.Command
			}
			if p.Replicas > 1 {
				body["replicas"] = p.Replicas
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
		fmt.Println("Done. Railway deploy triggers are not migrated — redeploy each service when ready.")
		return nil
	},
}

// railwayGraphQL posts a query; Railway returns 200 with an errors array on
// partial failures — treat errors as fatal, the migration needs clean data.
func railwayGraphQL(token, query string, variables map[string]interface{}) (map[string]interface{}, error) {
	body, _ := json.Marshal(map[string]interface{}{"query": query, "variables": variables})
	req, err := http.NewRequest(http.MethodPost, railwayAPI, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	// Project tokens use a dedicated header; account/workspace tokens use Bearer.
	if strings.HasPrefix(token, "rw_pat") || strings.HasPrefix(token, "rw_pt") {
		req.Header.Set("Project-Access-Token", token)
	} else {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	var out struct {
		Data   map[string]interface{} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("railway response not JSON (status %d)", resp.StatusCode)
	}
	if len(out.Errors) > 0 {
		return nil, fmt.Errorf("railway: %s", out.Errors[0].Message)
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("railway status %d", resp.StatusCode)
	}
	return out.Data, nil
}

// railwayProject resolves the project (by id, or sole accessible project) and
// returns its name, the target environment id, and its services.
func railwayProject(projectID, envName, token string) (string, string, []map[string]interface{}, error) {
	if projectID == "" {
		data, err := railwayGraphQL(token,
			`query { projects(first: 100) { edges { node { id name } } } }`, nil)
		if err != nil {
			return "", "", nil, err
		}
		projects := edgesOf(data, "projects")
		if len(projects) == 1 {
			projectID = str(projects[0], "id")
		} else {
			for _, p := range projects {
				fmt.Fprintf(os.Stderr, "  %s  %s\n", str(p, "id"), str(p, "name"))
			}
			return "", "", nil, &APIError{
				Message:  "multiple projects — pass --project <id> (listed above)",
				ExitCode: ExitError,
			}
		}
	}

	data, err := railwayGraphQL(token, `query ($id: String!) {
		project(id: $id) {
			name
			environments { edges { node { id name } } }
			services { edges { node { id name } } }
		}
	}`, map[string]interface{}{"id": projectID})
	if err != nil {
		return "", "", nil, err
	}
	project, _ := data["project"].(map[string]interface{})
	if project == nil {
		return "", "", nil, &APIError{Message: "railway project not found", ExitCode: ExitNotFound}
	}
	envs := edgesOf(project, "environments")
	envID := ""
	for _, e := range envs {
		if str(e, "name") == envName {
			envID = str(e, "id")
			break
		}
	}
	if envID == "" && len(envs) == 1 {
		envID = str(envs[0], "id")
	}
	if envID == "" {
		names := make([]string, 0, len(envs))
		for _, e := range envs {
			names = append(names, str(e, "name"))
		}
		return "", "", nil, &APIError{
			Message:  fmt.Sprintf("environment %q not found (have: %s)", envName, strings.Join(names, ", ")),
			ExitCode: ExitError,
		}
	}
	return str(project, "name"), envID, edgesOf(project, "services"), nil
}

// railwayServiceDetail pulls source, command, replicas, domains, and
// variables for one service in the target environment.
func railwayServiceDetail(svc map[string]interface{}, envID, token string) (railwayServicePlan, error) {
	plan := railwayServicePlan{
		ID:   str(svc, "id"),
		Name: str(svc, "name"),
	}
	data, err := railwayGraphQL(token, `query ($sid: String!, $eid: String!) {
		serviceInstance(serviceId: $sid, environmentId: $eid) {
			startCommand
			numReplicas
			source { repo image }
			domains { serviceDomains { domain } customDomains { domain } }
		}
	}`, map[string]interface{}{"sid": plan.ID, "eid": envID})
	if err != nil {
		return plan, err
	}
	inst, _ := data["serviceInstance"].(map[string]interface{})
	if inst == nil {
		return plan, fmt.Errorf("no service instance in this environment")
	}
	if src, ok := inst["source"].(map[string]interface{}); ok {
		plan.Source = railwaySource{Repo: str(src, "repo"), Image: str(src, "image")}
	}
	if cmd, ok := inst["startCommand"].(string); ok {
		plan.Command = cmd
	}
	if n, ok := inst["numReplicas"].(float64); ok {
		plan.Replicas = int(n)
	}
	if domains, ok := inst["domains"].(map[string]interface{}); ok {
		for _, group := range []string{"serviceDomains", "customDomains"} {
			if list, ok := domains[group].([]interface{}); ok {
				for _, d := range list {
					if m, ok := d.(map[string]interface{}); ok {
						if dom := str(m, "domain"); dom != "" && dom != "-" {
							plan.Domains = append(plan.Domains, dom)
						}
					}
				}
			}
		}
	}

	vdata, err := railwayGraphQL(token, `query ($sid: String!, $eid: String!) {
		variables(serviceId: $sid, environmentId: $eid)
	}`, map[string]interface{}{"sid": plan.ID, "eid": envID})
	if err == nil {
		if vars, ok := vdata["variables"].(map[string]interface{}); ok {
			plan.Variables = map[string]string{}
			for k, v := range vars {
				if s, ok := v.(string); ok {
					// Railway reference variables (${{…}}) resolve at deploy
					// time — carry them literally so they stay visible.
					plan.Variables[k] = s
				}
			}
		}
	}
	return plan, nil
}

// railwayRepoURL normalizes Railway's "owner/repo" to a cloneable https URL.
func railwayRepoURL(repo string) string {
	repo = strings.TrimSpace(repo)
	if repo == "" || repo == "-" {
		return ""
	}
	if strings.Contains(repo, "://") || strings.HasPrefix(repo, "git@") {
		return repo
	}
	return "https://github.com/" + repo
}

func edgesOf(obj map[string]interface{}, key string) []map[string]interface{} {
	conn, _ := obj[key].(map[string]interface{})
	edges, _ := conn["edges"].([]interface{})
	out := make([]map[string]interface{}, 0, len(edges))
	for _, e := range edges {
		if m, ok := e.(map[string]interface{}); ok {
			if node, ok := m["node"].(map[string]interface{}); ok {
				out = append(out, node)
			}
		}
	}
	return out
}

func init() {
	migrateRailwayCmd.Flags().String("token", "", "Railway API token (or RAILWAY_TOKEN env)")
	migrateRailwayCmd.Flags().String("project", "", "Railway project id (lists yours when omitted and >1 exists)")
	migrateRailwayCmd.Flags().String("environment", "production", "Railway environment name")
	migrateRailwayCmd.Flags().String("into", "", "existing Containr project id (default: create one)")
	migrateRailwayCmd.Flags().Bool("dry-run", false, "print the plan without creating anything")
	MigrateCmd.AddCommand(migrateRailwayCmd)
}
