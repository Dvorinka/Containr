// Package mcpserver exposes the Containr API as MCP tools over stdio.
// It reuses the CLI's thin client — same PAT auth, same endpoints —
// so agents reach everything the UI and CLI do.
package mcpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"containr/internal/cli/commands"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// spec describes one MCP tool as an HTTP call. {placeholder} segments in
// Path are filled from arguments; remaining string/number/bool args become
// the JSON body for POST/PUT/PATCH.
type spec struct {
	name        string
	description string
	method      string
	path        string
	// params are the arguments that fill path placeholders (required).
	params []string
	// bodyKeys restrict which args go into the request body; when empty all
	// non-param args are sent.
	bodyKeys []string
	// destructive tools refuse unless args["confirm"] == true.
	destructive bool
}

var tools []spec

func register(s spec) { tools = append(tools, s) }

func init() {
	register(spec{"containr_auth_status", "Show which profile/token is active and the authenticated identity", "GET", "/user/profile", nil, nil, false})

	// Personal access tokens
	register(spec{"containr_tokens_list", "List personal access tokens (metadata only, never values)", "GET", "/user/tokens", nil, nil, false})
	register(spec{"containr_tokens_create", "Create a personal access token. Args: name (required), scope (read|write|admin, default write), expires_in_days (0=never). Returns the raw token once.", "POST", "/user/tokens", nil, []string{"name", "scope", "expires_in_days"}, false})
	register(spec{"containr_tokens_revoke", "Revoke a personal access token by id. Requires confirm:true.", "DELETE", "/user/tokens/{id}", []string{"id"}, nil, true})

	// Projects
	register(spec{"containr_projects_list", "List projects", "GET", "/projects", nil, nil, false})
	register(spec{"containr_projects_get", "Get a project by id", "GET", "/projects/{id}", []string{"id"}, nil, false})
	register(spec{"containr_projects_create", "Create a project. Args: name (required), description.", "POST", "/projects", nil, []string{"name", "description"}, false})
	register(spec{"containr_projects_delete", "Delete a project and all its services. Requires confirm:true.", "DELETE", "/projects/{id}", []string{"id"}, nil, true})

	// Services
	register(spec{"containr_services_list", "List services in a project", "GET", "/projects/{project_id}/services", []string{"project_id"}, nil, false})
	register(spec{"containr_services_get", "Get a service by id", "GET", "/services/{id}", []string{"id"}, nil, false})
	register(spec{"containr_services_create", "Create a service in a project. Args: name (required), type, image, git_repo, git_branch, environment, port, domain, replicas, volumes = [{type: volume|bind, source, target, read_only}], builder = auto|railpack|nixpacks|dockerfile|static, cpu, memory, cpu_reserve, memory_reserve, static_build_cmd, static_dir.", "POST", "/projects/{project_id}/services", []string{"project_id"}, nil, false})
	register(spec{"containr_services_delete", "Delete a service. Requires confirm:true.", "DELETE", "/services/{id}", []string{"id"}, nil, true})
	register(spec{"containr_services_start", "Start a service", "POST", "/services/{id}/start", []string{"id"}, nil, false})
	register(spec{"containr_services_stop", "Stop a service", "POST", "/services/{id}/stop", []string{"id"}, nil, false})
	register(spec{"containr_services_restart", "Restart a service", "POST", "/services/{id}/restart", []string{"id"}, nil, false})
	register(spec{"containr_services_sleep", "Put a service to sleep immediately (scale to zero)", "POST", "/services/{id}/sleep", []string{"id"}, nil, false})
	register(spec{"containr_services_wake", "Wake a sleeping service", "POST", "/services/{id}/wake", []string{"id"}, nil, false})
	register(spec{"containr_services_env_check", "Diagnose service env: returns ok plus unresolved ${{refs}}, empty vars, and undecryptable secrets", "GET", "/services/{id}/env-check", []string{"id"}, nil, false})
	register(spec{"containr_services_redeploy", "Rebuild and redeploy a service", "POST", "/services/{id}/redeploy", []string{"id"}, nil, false})
	register(spec{"containr_services_clone", "Clone a service (config, volumes, domains, variables) into the same or another project. Args: id, name, project_id, environment.", "POST", "/services/{id}/clone", []string{"id"}, nil, false})
	register(spec{"containr_services_move", "Move a service to another project the caller owns. Args: id, project_id (required).", "POST", "/services/{id}/move", []string{"id"}, []string{"project_id"}, false})
	register(spec{"containr_services_logs", "Get service runtime logs. Args: id, tail (default 100).", "GET", "/services/{id}/logs", []string{"id"}, nil, false})
	register(spec{"containr_services_exec", "Run a one-off command in the service container (30s ceiling). Args: id, command (required).", "POST", "/services/{id}/exec", []string{"id"}, []string{"command"}, false})
	register(spec{"containr_services_update", "Update a service. Args: id, name, image, command, domain, restart_policy, healthcheck_path, cpu, memory, replicas, port, volumes = [{type: volume|bind, source, target, read_only}] — volumes replaces the whole mount list; pass [] to clear. maintenance_mode (bool), basic_auth = [{username, password}] — replaces all creds; [] clears. builder = auto|railpack|nixpacks|dockerfile|static, cpu_reserve, memory_reserve, static_build_cmd, static_dir (empty string clears reserves/static fields). sleep_enabled (bool) + sleep_idle_minutes (1-1440) enable scale-to-zero on idle; a wake placeholder answers traffic while the service resumes.", "PUT", "/services/{id}", []string{"id"}, nil, false})

	// Domains
	register(spec{"containr_domains_list", "List domains attached to a service", "GET", "/services/{id}/domains", []string{"id"}, nil, false})
	register(spec{"containr_domains_add", "Attach a domain to a service. Args: id, domain (required), is_default.", "POST", "/services/{id}/domains", []string{"id"}, []string{"domain", "is_default"}, false})
	register(spec{"containr_domains_remove", "Detach a domain. Args: id (service), domain_id.", "DELETE", "/services/{id}/domains/{domain_id}", []string{"id", "domain_id"}, nil, false})
	register(spec{"containr_domains_default", "Set the default domain. Args: id (service), domain_id.", "POST", "/services/{id}/domains/{domain_id}/default", []string{"id", "domain_id"}, nil, false})
	register(spec{"containr_domains_check", "DNS preflight for all service domains — returns ok|wrong-target|pending per domain", "GET", "/services/{id}/domains/check", []string{"id"}, nil, false})

	// Registries — private-image pull credentials, owner-scoped.
	register(spec{"containr_registries_list", "List registry credentials (passwords never returned)", "GET", "/registries", nil, nil, false})
	register(spec{"containr_registries_create", "Add a registry credential. Args: name (required), host (required — e.g. ghcr.io, docker.io), username, password (stored encrypted).", "POST", "/registries", nil, []string{"name", "host"}, false})
	register(spec{"containr_registries_update", "Update a registry credential. Args: id, name, host (required), username, password (empty keeps stored).", "PUT", "/registries/{id}", []string{"id"}, []string{"name", "host"}, false})
	register(spec{"containr_registries_delete", "Remove a registry credential. Requires confirm:true.", "DELETE", "/registries/{id}", []string{"id"}, nil, true})

	// Docker volumes (admin)
	register(spec{"containr_volumes_list", "List docker volumes on the node with in-use flags (admin)", "GET", "/admin/volumes", nil, nil, false})
	register(spec{"containr_volumes_delete", "Delete an unused docker volume. Requires confirm:true. (admin)", "DELETE", "/admin/volumes/{name}", []string{"name"}, nil, true})

	// Variables
	register(spec{"containr_variables_list", "List service environment variables (secrets masked)", "GET", "/services/{id}/variables", []string{"id"}, nil, false})
	register(spec{"containr_variables_set", "Replace all variables on a service. Args: id, variables = [{key, value, is_secret}], redeploy (queue a redeploy to apply). Fetch the current list first and merge — the server replaces wholesale.", "PUT", "/services/{id}/variables", []string{"id"}, []string{"variables", "redeploy"}, false})
	register(spec{"containr_shared_variables_list", "List project-level shared variables, referenced from service env as ${{shared.KEY}} (secrets masked). Args: id (project).", "GET", "/projects/{id}/variables", []string{"id"}, nil, false})
	register(spec{"containr_shared_variables_set", "Replace all shared project variables. Args: id (project), variables = [{key, value, is_secret}]. Services reference them as ${{shared.KEY}} — resolved at deploy/refresh, not live-updated.", "PUT", "/projects/{id}/variables", []string{"id"}, []string{"variables"}, false})

	// Deployments
	register(spec{"containr_deploy", "Trigger a deployment for a service. Args: id (service), commit_hash, branch, no_cache.", "POST", "/services/{id}/deployments", []string{"id"}, []string{"commit_hash", "branch", "trigger", "no_cache"}, false})
	register(spec{"containr_deployments_list", "List recent deployments across services", "GET", "/deployments", nil, nil, false})
	register(spec{"containr_services_deployments", "List deployments for one service", "GET", "/services/{id}/deployments", []string{"id"}, nil, false})
	register(spec{"containr_deployments_get", "Get a deployment", "GET", "/deployments/{id}", []string{"id"}, nil, false})
	register(spec{"containr_deployments_logs", "Get persisted build/runtime logs for a deployment. Args: id, type (all|build|runtime).", "GET", "/deployments/{id}/logs", []string{"id"}, nil, false})
	register(spec{"containr_deployments_rollback", "Roll back to a deployment. Requires confirm:true.", "POST", "/deployments/{id}/rollback", []string{"id"}, nil, true})
	register(spec{"containr_deployments_cancel", "Cancel a queued or running deployment", "POST", "/deployments/{id}/cancel", []string{"id"}, nil, false})

	// Databases
	register(spec{"containr_databases_list", "List managed databases", "GET", "/databases", nil, nil, false})
	register(spec{"containr_databases_get", "Get a database (connection URL included)", "GET", "/databases/{id}", []string{"id"}, nil, false})
	register(spec{"containr_databases_create", "Provision a managed database. Args: name, type (postgres|mysql|mariadb|mongodb|redis|dragonfly|clickhouse), public_port (bind on all interfaces, default localhost-only).", "POST", "/databases", nil, nil, false})
	register(spec{"containr_databases_update", "Update a database. Args: id, name, backup_schedule (empty clears), backup_target_id (empty clears), public_port — toggling recreates the container so the new bind scope applies.", "PUT", "/databases/{id}", []string{"id"}, nil, false})
	register(spec{"containr_databases_register_external", "Register a database hosted elsewhere — probed first, password stored encrypted. Args: name (required), type (required), host (required), port, database, username, password, ssl.", "POST", "/databases/register-external", nil, []string{"name", "type", "host"}, false})
	register(spec{"containr_databases_test_connection", "Probe a DB connection ad-hoc. Args: type, host (required), port, database, username, password, ssl.", "POST", "/databases/test-connection", nil, []string{"type", "host"}, false})
	register(spec{"containr_databases_test_connection_by_id", "Re-probe a registered external database with its stored credentials. Args: id.", "POST", "/databases/{id}/test-connection", []string{"id"}, nil, false})
	register(spec{"containr_databases_action", "Start/stop/restart a database. Args: id, action.", "POST", "/databases/{id}/action", []string{"id"}, []string{"action"}, false})
	register(spec{"containr_databases_backup", "Take a manual backup snapshot", "POST", "/databases/{id}/backup", []string{"id"}, nil, false})
	register(spec{"containr_databases_restore", "Restore a database from a backup — overwrites current data. Requires confirm:true.", "POST", "/databases/{id}/restore", []string{"id"}, []string{"backup_id"}, true})
	register(spec{"containr_databases_delete", "Delete a database and its data. Requires confirm:true.", "DELETE", "/databases/{id}", []string{"id"}, nil, true})

	// S3-compatible backup targets
	register(spec{"containr_backup_targets_list", "List S3-compatible backup targets (credentials never returned)", "GET", "/backup-targets", nil, nil, false})
	register(spec{"containr_backup_targets_create", "Register a backup target — probed first, keys stored encrypted. Args: name, endpoint (required), bucket (required), region, prefix, access_key, secret_key, use_tls.", "POST", "/backup-targets", nil, []string{"endpoint", "bucket"}, false})
	register(spec{"containr_backup_targets_update", "Update a backup target; empty credentials keep stored keys. Args: id, name, endpoint, bucket, region, prefix, access_key, secret_key, use_tls.", "PUT", "/backup-targets/{id}", []string{"id"}, nil, false})
	register(spec{"containr_backup_targets_delete", "Delete a backup target — fails while databases still point at it. Requires confirm:true.", "DELETE", "/backup-targets/{id}", []string{"id"}, nil, true})
	register(spec{"containr_backup_targets_test", "Re-probe a backup target's bucket access. Args: id.", "POST", "/backup-targets/{id}/test", []string{"id"}, nil, false})

	// Cron
	register(spec{"containr_cron_list", "List cron jobs", "GET", "/cron-jobs", nil, nil, false})
	register(spec{"containr_cron_create", "Create a cron job. Args: service_id, schedule (5-field), command, name, timezone.", "POST", "/cron-jobs", nil, nil, false})
	register(spec{"containr_cron_trigger", "Run a cron job now", "POST", "/cron-jobs/{id}/trigger", []string{"id"}, nil, false})
	register(spec{"containr_cron_executions", "List a cron job's execution history", "GET", "/cron-jobs/{id}/executions", []string{"id"}, nil, false})
	register(spec{"containr_cron_delete", "Delete a cron job. Requires confirm:true.", "DELETE", "/cron-jobs/{id}", []string{"id"}, nil, true})

	// Templates
	register(spec{"containr_templates_list", "List templates", "GET", "/templates", nil, nil, false})
	register(spec{"containr_templates_get", "Get a template definition", "GET", "/templates/{id}", []string{"id"}, nil, false})
	register(spec{"containr_templates_deploy", "Deploy a template into a project. Args: id (template), project_id.", "POST", "/templates/{id}/deploy", []string{"id"}, []string{"project_id"}, false})
	register(spec{"containr_templates_plan", "Dry-resolve a template: expanded expressions, service refs, missing variables. Args: id, variables (object).", "POST", "/templates/{id}/plan", []string{"id"}, nil, false})
	register(spec{"containr_templates_import_compose", "Convert docker-compose YAML into a v2 template graph config. Args: compose_yaml.", "POST", "/templates/import/compose", nil, []string{"compose_yaml"}, false})
	register(spec{"containr_templates_deploy_graph", "Deploy an ad-hoc service graph without a stored template. Args: project_id, config ({services:[...]}), variables, plan, region.", "POST", "/templates/deploy", nil, []string{"project_id", "config", "variables", "plan", "region"}, false})
	register(spec{"containr_projects_import_compose", "Deploy a docker-compose file straight into a project. Args: id (project), compose_yaml, variables, plan, region.", "POST", "/projects/{id}/import-compose", []string{"id"}, []string{"compose_yaml", "variables", "plan", "region"}, false})

	// Notifications
	register(spec{"containr_notifications_list", "List notifications", "GET", "/notifications", nil, nil, false})
	register(spec{"containr_notifications_read", "Mark a notification read, or all notifications with id=all", "POST", "/notifications/{id}/read", []string{"id"}, nil, false})

	register(spec{"containr_webhooks_list", "List outbound webhooks", "GET", "/webhooks", nil, nil, false})
	register(spec{"containr_webhooks_create", "Create an outbound webhook. Args: name, url, events (list, e.g. [\"service.*\",\"*\"]), secret (auto-generated if omitted), headers, enabled.", "POST", "/webhooks", nil, []string{"name", "url", "events", "secret", "headers", "enabled"}, false})
	register(spec{"containr_webhooks_update", "Update an outbound webhook. Args: id, plus name/url/secret/events/headers/enabled to change.", "PATCH", "/webhooks/{id}", []string{"id"}, []string{"name", "url", "secret", "events", "headers", "enabled"}, false})
	register(spec{"containr_webhooks_delete", "Delete an outbound webhook. Args: id. Requires confirm=true.", "DELETE", "/webhooks/{id}", []string{"id"}, nil, true})
	register(spec{"containr_webhooks_deliveries", "List recent delivery attempts for a webhook. Args: id.", "GET", "/webhooks/{id}/deliveries", []string{"id"}, nil, false})
	register(spec{"containr_webhooks_test", "Queue a test ping delivery for a webhook. Args: id.", "POST", "/webhooks/{id}/test", []string{"id"}, nil, false})

	register(spec{"containr_operations_get", "Cross-cutting operations view: active deployments, deploy queue depth, recent failures, cron runs, backups.", "GET", "/operations", nil, nil, false})

	register(spec{"containr_banners_active", "List active announcement banners shown to users.", "GET", "/banners/active", nil, nil, false})
	register(spec{"containr_banners_list", "List all announcement banners (admin).", "GET", "/admin/banners", nil, nil, false})
	register(spec{"containr_banners_create", "Create an announcement banner (admin). Args: title, body, level (info|success|warning|error), active, dismissible, starts_at, ends_at.", "POST", "/admin/banners", nil, []string{"title", "body", "level", "active", "dismissible", "starts_at", "ends_at"}, false})
	register(spec{"containr_banners_update", "Update an announcement banner (admin). Args: id plus fields to change.", "PATCH", "/admin/banners/{id}", []string{"id"}, []string{"title", "body", "level", "active", "dismissible", "starts_at", "ends_at"}, false})
	register(spec{"containr_banners_delete", "Delete an announcement banner (admin). Args: id. Requires confirm=true.", "DELETE", "/admin/banners/{id}", []string{"id"}, nil, true})

	register(spec{"containr_branding_get", "Get instance white-label branding (product name, logo, accent, links).", "GET", "/branding", nil, nil, false})
	register(spec{"containr_settings_update", "Update platform settings (admin). Args: signup_enabled (bool), cloudflare_tunnel_token (string, empty clears), branding (object: product_name, logo_url, favicon_url, accent_color, docs_url, support_url — empty string resets a field).", "PUT", "/settings", nil, []string{"signup_enabled", "cloudflare_tunnel_token", "branding"}, false})

	register(spec{"containr_invites_list", "List team invite links (admin).", "GET", "/admin/invites", nil, nil, false})
	register(spec{"containr_invites_create", "Create a team invite link (admin). Args: email (optional bind), expires_in_hours (default 168). Returns the one-time token + accept URL.", "POST", "/admin/invites", nil, []string{"email", "expires_in_hours"}, false})
	register(spec{"containr_invites_revoke", "Revoke a team invite (admin). Args: id. Requires confirm=true.", "DELETE", "/admin/invites/{id}", []string{"id"}, nil, true})
	register(spec{"containr_admin_impersonate", "Mint a 15-minute bearer token acting as a user (admin, audit-logged). Args: id (user id).", "POST", "/admin/users/{id}/impersonate", []string{"id"}, nil, false})
	register(spec{"containr_github_app_status", "Show GitHub App provisioning status (admin).", "GET", "/admin/git/github-app", nil, nil, false})
	register(spec{"containr_github_app_manifest", "Build a GitHub App manifest for self-provisioning (admin). Args: base_url (required, https public URL), name (optional), organization (optional).", "POST", "/admin/git/github-app/manifest", nil, []string{"base_url", "name", "organization"}, false})
	register(spec{"containr_github_app_convert", "Exchange the GitHub manifest callback code for app credentials (admin). Args: code.", "POST", "/admin/git/github-app/convert", nil, []string{"code"}, false})
	register(spec{"containr_activity_list", "Activity feed — enriched audit events (severity/category/label). Args: severity, category, resource, project_id, since, page, limit.", "GET", "/activity", nil, []string{"severity", "category", "resource", "project_id", "since", "page", "limit"}, false})
	register(spec{"containr_project_activity", "Per-project activity timeline. Args: id (project id), page, limit.", "GET", "/projects/{id}/activity", []string{"id"}, []string{"page", "limit"}, false})

	// Nodes / agent tokens (admin)
	register(spec{"containr_nodes_list", "List node agents (admin)", "GET", "/agents", nil, nil, false})
	register(spec{"containr_nodes_get", "Get a node agent (admin)", "GET", "/agents/{id}", []string{"id"}, nil, false})
	register(spec{"containr_agent_tokens_issue", "Issue an agent onboarding token (admin). Args: label.", "POST", "/agent-tokens", nil, []string{"label"}, false})
	register(spec{"containr_agent_tokens_list", "List agent onboarding tokens (admin)", "GET", "/agent-tokens", nil, nil, false})

	// Scaling / HA / security
	register(spec{"containr_scaling_status", "Autoscaler status", "GET", "/scaling/status", nil, nil, false})
	register(spec{"containr_scaling_policies", "List scaling policies", "GET", "/scaling/policies", nil, nil, false})
	register(spec{"containr_scaling_scale", "Manually scale a service. Args: service_id, replicas. (admin)", "POST", "/scaling/services/{service_id}/scale", []string{"service_id"}, []string{"replicas"}, false})
	register(spec{"containr_ha_status", "HA manager status", "GET", "/ha/status", nil, nil, false})
	register(spec{"containr_ha_alerts", "Active HA alerts", "GET", "/ha/alerts/active", nil, nil, false})
	register(spec{"containr_ha_failover", "Trigger a manual failover — reschedules services. Requires confirm:true. (admin)", "POST", "/ha/failover", nil, nil, true})
	register(spec{"containr_security_scan", "Run a security scan. Args: project_id (required), scan_type, service_id.", "POST", "/security/scans", nil, nil, false})
	register(spec{"containr_security_vulnerabilities", "List a project's vulnerabilities", "GET", "/projects/{project_id}/vulnerabilities", []string{"project_id"}, nil, false})

	// Admin
	register(spec{"containr_admin_overview", "Platform overview (admin)", "GET", "/admin/overview", nil, nil, false})
	register(spec{"containr_admin_users", "List all users (admin)", "GET", "/admin/users", nil, nil, false})
	register(spec{"containr_admin_audit_logs", "List audit log entries (admin)", "GET", "/audit-logs", nil, nil, false})
	register(spec{"containr_gateway_services", "List gateway services (admin)", "GET", "/gateway/services", nil, nil, false})
	register(spec{"containr_gateway_keys", "List gateway API keys (admin)", "GET", "/gateway/keys", nil, nil, false})
}

// Run starts the stdio MCP server. apiURL/token come from env or config —
// the caller resolves them before calling.
func Run(ctx context.Context, apiURL, token, version string) error {
	if token == "" {
		return fmt.Errorf("CONTAINR_TOKEN is required (create a cnp_ token under Settings → Personal Access Tokens)")
	}
	client := &commands.Client{BaseURL: apiURL, Token: token}

	server := mcp.NewServer(&mcp.Implementation{
		Name:    "containr",
		Version: version,
	}, nil)

	for _, s := range tools {
		s := s
		server.AddTool(&mcp.Tool{
			Name:        s.name,
			Description: s.description,
			InputSchema: schemaFor(s),
		}, func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return call(ctx, client, s, req)
		})
	}

	return server.Run(ctx, &mcp.StdioTransport{})
}

// schemaFor builds a JSON Schema for the tool's arguments: path params +
// body keys + confirm for destructive tools. Properties accept any JSON
// type — the API validates values.
func schemaFor(s spec) map[string]interface{} {
	props := map[string]interface{}{}
	var required []string
	for _, p := range s.params {
		props[p] = map[string]interface{}{"type": "string", "description": "path parameter"}
		required = append(required, p)
	}
	bodySrc := s.bodyKeys
	if len(bodySrc) == 0 && s.method != "GET" && s.method != "DELETE" {
		// Unrestricted body: advertise nothing, accept anything.
	}
	for _, k := range bodySrc {
		props[k] = map[string]interface{}{"description": "request body field"}
	}
	if s.destructive {
		props["confirm"] = map[string]interface{}{"type": "boolean", "description": "must be true — this operation is destructive"}
		required = append(required, "confirm")
	}
	schema := map[string]interface{}{
		"type":                 "object",
		"properties":           props,
		"additionalProperties": true,
	}
	if len(required) > 0 {
		schema["required"] = required
	}
	return schema
}

func call(ctx context.Context, c *commands.Client, s spec, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	var args map[string]interface{}
	if len(req.Params.Arguments) > 0 {
		if err := json.Unmarshal(req.Params.Arguments, &args); err != nil {
			return errorResult("invalid arguments: " + err.Error()), nil
		}
	}
	if args == nil {
		args = map[string]interface{}{}
	}

	if s.destructive && args["confirm"] != true {
		return errorResult("destructive operation — pass confirm:true to proceed"), nil
	}

	path := s.path
	for _, p := range s.params {
		v, ok := args[p]
		if !ok || fmt.Sprint(v) == "" {
			return errorResult(fmt.Sprintf("missing required argument %q", p)), nil
		}
		path = strings.ReplaceAll(path, "{"+p+"}", fmt.Sprint(v))
	}

	var body interface{}
	var query []string
	for k, v := range args {
		if k == "confirm" {
			continue
		}
		inParams := false
		for _, p := range s.params {
			if k == p {
				inParams = true
				break
			}
		}
		if inParams {
			continue
		}
		if s.method == "GET" || s.method == "DELETE" {
			// Non-path args on reads become query parameters.
			query = append(query, url.QueryEscape(k)+"="+url.QueryEscape(fmt.Sprint(v)))
			continue
		}
		if len(s.bodyKeys) > 0 {
			allowed := false
			for _, b := range s.bodyKeys {
				if k == b {
					allowed = true
					break
				}
			}
			if !allowed {
				continue
			}
		}
		if body == nil {
			body = map[string]interface{}{}
		}
		body.(map[string]interface{})[k] = v
	}
	if len(query) > 0 {
		sep := "?"
		if strings.Contains(path, "?") {
			sep = "&"
		}
		path += sep + strings.Join(query, "&")
	}

	data, err := c.Do(s.method, path, body)
	if err != nil {
		return errorResult(err.Error()), nil
	}
	return textResult(data), nil
}

func textResult(data []byte) *mcp.CallToolResult {
	var v interface{}
	if json.Unmarshal(data, &v) != nil {
		v = string(data)
	}
	out, _ := json.MarshalIndent(v, "", "  ")
	return &mcp.CallToolResult{
		Content: []mcp.Content{&mcp.TextContent{Text: string(out)}},
	}
}

func errorResult(msg string) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		IsError: true,
		Content: []mcp.Content{&mcp.TextContent{Text: msg}},
	}
}
