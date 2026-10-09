package commands

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

// ServicesCmd manages services.
var ServicesCmd = &cobra.Command{
	Use:     "services",
	Aliases: []string{"service", "svc"},
	Short:   "Manage services",
}

var servicesListCmd = &cobra.Command{
	Use:   "list [project-id]",
	Short: "List services in a project",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/projects/"+args[0]+"/services", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "services")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, s := range items {
			rows = append(rows, []string{
				str(s, "id"), str(s, "name"), str(s, "type"), str(s, "status"), str(s, "environment"),
			})
		}
		printRows(data, []string{"ID", "NAME", "TYPE", "STATUS", "ENV"}, rows)
		return nil
	},
}

var servicesGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Show a service",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/services/"+args[0], nil)
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		s, _ := unwrapObject(data, "service")
		for _, k := range []string{"id", "name", "type", "status", "environment", "image", "git_repo", "git_branch", "domain", "port", "node_name"} {
			fmt.Printf("%-14s %s\n", k+":", str(s, k))
		}
		return nil
	},
}

var servicesCreateCmd = &cobra.Command{
	Use:   "create <project-id> <name>",
	Short: "Create a service (image- or git-based)",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		body := map[string]interface{}{
			"name": args[1],
		}
		for _, f := range []string{"type", "image", "git-repo", "git-branch", "build-path", "command", "environment", "domain", "restart-policy", "healthcheck-path", "cpu", "memory", "builder", "cpu-reserve", "memory-reserve", "static-cmd", "static-dir", "node"} {
			if v, _ := cmd.Flags().GetString(f); v != "" {
				key := f
				// JSON uses snake_case keys matching the API schema.
				switch f {
				case "git-repo":
					key = "git_repo"
				case "git-branch":
					key = "git_branch"
				case "build-path":
					key = "build_path"
				case "restart-policy":
					key = "restart_policy"
				case "healthcheck-path":
					key = "healthcheck_path"
				case "cpu-reserve":
					key = "cpu_reserve"
				case "memory-reserve":
					key = "memory_reserve"
				case "static-cmd":
					key = "static_build_cmd"
				case "static-dir":
					key = "static_dir"
				case "node":
					key = "node_id"
				}
				body[key] = v
			}
		}
		if v, _ := cmd.Flags().GetInt("port"); v > 0 {
			body["port"] = v
		}
		if v, _ := cmd.Flags().GetInt("replicas"); v > 0 {
			body["replicas"] = v
		}
		if v, _ := cmd.Flags().GetBool("spread"); v {
			body["spread"] = v
		}
		if cmd.Flags().Changed("sleep") {
			v, _ := cmd.Flags().GetBool("sleep")
			body["sleep_enabled"] = v
		}
		if cmd.Flags().Changed("sleep-idle") {
			v, _ := cmd.Flags().GetInt("sleep-idle")
			body["sleep_idle_minutes"] = v
		}
		if v, _ := cmd.Flags().GetString("placement-tags"); v != "" {
			tags := []string{}
			for _, t := range strings.Split(v, ",") {
				if t = strings.TrimSpace(t); t != "" {
					tags = append(tags, t)
				}
			}
			body["placement_tags"] = tags
		}
		if labels, err := traefikLabelFlag(cmd); err != nil {
			return err
		} else if labels != nil {
			body["traefik_labels"] = labels
		}
		data, err := c.Do("POST", "/projects/"+args[0]+"/services", body)
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		s, _ := unwrapObject(data, "service")
		fmt.Printf("Created service %s (%s)\n", str(s, "name"), str(s, "id"))
		return nil
	},
}

// traefikLabelFlag parses --traefik-label key=value pairs into the API's
// map shape. Returns nil when the flag was never passed; an empty map when
// only empty values were given (clears overrides on update).
func traefikLabelFlag(cmd *cobra.Command) (map[string]string, error) {
	if !cmd.Flags().Changed("traefik-label") {
		return nil, nil
	}
	pairs, _ := cmd.Flags().GetStringArray("traefik-label")
	labels := map[string]string{}
	for _, p := range pairs {
		if strings.TrimSpace(p) == "" {
			continue
		}
		k, v, ok := strings.Cut(p, "=")
		if !ok || strings.TrimSpace(k) == "" {
			return nil, &APIError{Message: fmt.Sprintf("invalid --traefik-label %q — want key=value", p), ExitCode: ExitError}
		}
		labels[strings.TrimSpace(k)] = v
	}
	return labels, nil
}

var servicesDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a service",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if !Confirm(fmt.Sprintf("Delete service %s?", args[0])) {
			return &APIError{Message: "aborted (pass --yes to skip confirmation)", ExitCode: ExitError}
		}
		if _, err := c.Do("DELETE", "/services/"+args[0], nil); err != nil {
			return err
		}
		if JSONMode() {
			return PrintJSON(map[string]string{"status": "deleted", "id": args[0]})
		}
		fmt.Printf("Deleted service %s\n", args[0])
		return nil
	},
}

var servicesUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update a service (volumes, replicas, domain, ...)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		body := map[string]interface{}{}
		for _, f := range []string{"name", "image", "command", "domain", "restart-policy", "healthcheck-path", "cpu", "memory", "builder", "cpu-reserve", "memory-reserve", "static-cmd", "static-dir", "node"} {
			if cmd.Flags().Changed(f) {
				key := f
				switch f {
				case "restart-policy":
					key = "restart_policy"
				case "healthcheck-path":
					key = "healthcheck_path"
				case "cpu-reserve":
					key = "cpu_reserve"
				case "memory-reserve":
					key = "memory_reserve"
				case "static-cmd":
					key = "static_build_cmd"
				case "static-dir":
					key = "static_dir"
				case "node":
					key = "node_id"
				}
				v, _ := cmd.Flags().GetString(f)
				body[key] = v
			}
		}
		if cmd.Flags().Changed("replicas") {
			v, _ := cmd.Flags().GetInt("replicas")
			body["replicas"] = v
		}
		if cmd.Flags().Changed("port") {
			v, _ := cmd.Flags().GetInt("port")
			body["port"] = v
		}
		if cmd.Flags().Changed("volume") || cmd.Flags().Changed("bind") || cmd.Flags().Changed("clear-volumes") {
			volumes := []map[string]interface{}{}
			for _, spec := range volumeFlagValues(cmd, "volume", "bind") {
				volumes = append(volumes, spec)
			}
			body["volumes"] = volumes
		}
		if cmd.Flags().Changed("sleep") {
			v, _ := cmd.Flags().GetBool("sleep")
			body["sleep_enabled"] = v
		}
		if cmd.Flags().Changed("spread") {
			v, _ := cmd.Flags().GetBool("spread")
			body["spread"] = v
		}
		if cmd.Flags().Changed("placement-tags") {
			v, _ := cmd.Flags().GetString("placement-tags")
			tags := []string{}
			for _, t := range strings.Split(v, ",") {
				if t = strings.TrimSpace(t); t != "" {
					tags = append(tags, t)
				}
			}
			body["placement_tags"] = tags
		}
		if cmd.Flags().Changed("sleep-idle") {
			v, _ := cmd.Flags().GetInt("sleep-idle")
			body["sleep_idle_minutes"] = v
		}
		if labels, err := traefikLabelFlag(cmd); err != nil {
			return err
		} else if labels != nil {
			body["traefik_labels"] = labels
		}
		if cmd.Flags().Changed("maintenance") {
			v, _ := cmd.Flags().GetString("maintenance")
			body["maintenance_mode"] = v == "on" || v == "true"
		}
		if cmd.Flags().Changed("basic-auth") {
			creds := []map[string]interface{}{}
			pairs, _ := cmd.Flags().GetStringArray("basic-auth")
			for _, p := range pairs {
				user, pass, ok := strings.Cut(p, ":")
				if ok {
					creds = append(creds, map[string]interface{}{"username": user, "password": pass})
				}
			}
			body["basic_auth"] = creds
		}
		if len(body) == 0 {
			return &APIError{Message: "nothing to update — pass a flag", ExitCode: ExitError}
		}
		data, err := c.Do("PUT", "/services/"+args[0], body)
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		fmt.Printf("Updated service %s\n", args[0])
		return nil
	},
}

var servicesCloneCmd = &cobra.Command{
	Use:   "clone <id>",
	Short: "Clone a service (config, volumes, domains, variables)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		body := map[string]interface{}{}
		for _, f := range []string{"name", "project", "environment"} {
			if v, _ := cmd.Flags().GetString(f); v != "" {
				key := f
				if f == "project" {
					key = "project_id"
				}
				body[key] = v
			}
		}
		data, err := c.Do("POST", "/services/"+args[0]+"/clone", body)
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		m, _ := unwrapObject(data)
		fmt.Printf("Cloned to service %s (%s)\n", str(m, "service_id"), str(m, "name"))
		return nil
	},
}

var servicesMoveCmd = &cobra.Command{
	Use:   "move <id> <project-id>",
	Short: "Move a service to another project",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", "/services/"+args[0]+"/move", map[string]interface{}{"project_id": args[1]})
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		fmt.Printf("Moved service %s to project %s\n", args[0], args[1])
		return nil
	},
}

// volumeFlagValues parses repeated "src:target[:ro]" flags into API mount
// objects. Bind mounts are type=bind, named volumes type=volume.
func volumeFlagValues(cmd *cobra.Command, flags ...string) []map[string]interface{} {
	var out []map[string]interface{}
	for _, f := range flags {
		vals, _ := cmd.Flags().GetStringArray(f)
		for _, v := range vals {
			parts := strings.SplitN(v, ":", 3)
			if len(parts) < 2 {
				continue
			}
			m := map[string]interface{}{
				"type":   f,
				"source": parts[0],
				"target": parts[1],
			}
			if len(parts) == 3 && parts[2] == "ro" {
				m["read_only"] = true
			}
			out = append(out, m)
		}
	}
	return out
}

var servicesDomainsCmd = &cobra.Command{
	Use:   "domains",
	Short: "Manage service domains",
}

var domainsListCmd = &cobra.Command{
	Use:   "list <service-id>",
	Short: "List domains attached to a service",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/services/"+args[0]+"/domains", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "domains")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, d := range items {
			def := ""
			if b, ok := d["is_default"].(bool); ok && b {
				def = "*"
			}
			rows = append(rows, []string{str(d, "id"), str(d, "domain"), def, str(d, "cert_status")})
		}
		printRows(data, []string{"ID", "DOMAIN", "DEFAULT", "CERT"}, rows)
		return nil
	},
}

var domainsAddCmd = &cobra.Command{
	Use:   "add <service-id> <domain>",
	Short: "Attach a domain to a service",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		def, _ := cmd.Flags().GetBool("default")
		data, err := c.Do("POST", "/services/"+args[0]+"/domains", map[string]interface{}{
			"domain": args[1], "is_default": def,
		})
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		fmt.Printf("Added domain %s\n", args[1])
		return nil
	},
}

var domainsRemoveCmd = &cobra.Command{
	Use:   "remove <service-id> <domain-id>",
	Short: "Detach a domain",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		if _, err := c.Do("DELETE", fmt.Sprintf("/services/%s/domains/%s", args[0], args[1]), nil); err != nil {
			return err
		}
		if JSONMode() {
			return PrintJSON(map[string]string{"status": "deleted", "id": args[1]})
		}
		fmt.Printf("Removed domain %s\n", args[1])
		return nil
	},
}

var domainsDefaultCmd = &cobra.Command{
	Use:   "default <service-id> <domain-id>",
	Short: "Set the default domain",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", fmt.Sprintf("/services/%s/domains/%s/default", args[0], args[1]), map[string]interface{}{})
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		fmt.Printf("Default domain updated\n")
		return nil
	},
}

var domainsCheckCmd = &cobra.Command{
	Use:   "check <service-id>",
	Short: "DNS preflight for all service domains",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/services/"+args[0]+"/domains/check", nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "domains")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, d := range items {
			resolved, _ := d["resolved"].([]interface{})
			addrs := make([]string, 0, len(resolved))
			for _, a := range resolved {
				if s, ok := a.(string); ok {
					addrs = append(addrs, s)
				}
			}
			rows = append(rows, []string{str(d, "domain"), str(d, "status"), strings.Join(addrs, ", ")})
		}
		printRows(data, []string{"DOMAIN", "STATUS", "RESOLVED"}, rows)
		return nil
	},
}

// serviceAction returns a RunE for the simple POST action endpoints.
func serviceAction(verb string) func(*cobra.Command, []string) error {
	return func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("POST", fmt.Sprintf("/services/%s/%s", args[0], verb), map[string]interface{}{})
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		fmt.Printf("%s: %s\n", verb, args[0])
		return nil
	}
}

func init() {
	f := servicesCreateCmd.Flags()
	f.String("type", "web", "service type: web|worker|database|cron")
	f.String("image", "", "container image (image-based service)")
	f.String("git-repo", "", "git repository URL (build-from-source service)")
	f.String("git-branch", "main", "git branch")
	f.String("build-path", "", "build context subdirectory")
	f.String("command", "", "container start command override")
	f.String("environment", "production", "production|preview|development")
	f.String("domain", "", "public domain")
	f.String("restart-policy", "unless-stopped", "docker restart policy")
	f.String("healthcheck-path", "", "HTTP health check path")
	f.String("cpu", "", "CPU limit (e.g. 0.5)")
	f.String("memory", "", "memory limit (e.g. 512m)")
	f.Int("port", 0, "container port")
	f.Int("replicas", 0, "replica count")
	f.String("builder", "", "build strategy: auto|railpack|nixpacks|dockerfile|static")
	f.String("cpu-reserve", "", "soft CPU reservation (e.g. 0.25)")
	f.String("memory-reserve", "", "soft memory reservation (e.g. 128Mi)")
	f.String("static-cmd", "", "build command for the static builder")
	f.String("static-dir", "", "output dir for the static builder (default dist)")
	f.String("node", "", "pin to a node agent id, or 'auto' for least-loaded")
	f.Bool("spread", false, "distribute replicas across all online schedulable nodes")
	f.Bool("sleep", false, "enable scale-to-zero on idle (sleep mode)")
	f.Int("sleep-idle", 0, "idle minutes before sleeping (1-1440)")
	f.String("placement-tags", "", "comma-separated node tags required for remote placement (auto/spread only)")
	f.StringArray("traefik-label", nil, "Traefik middleware override, key=value (e.g. middlewares.rl.ratelimit.average=100); repeatable")

	uf := servicesUpdateCmd.Flags()
	uf.String("name", "", "service name")
	uf.String("image", "", "container image")
	uf.String("command", "", "container start command")
	uf.String("domain", "", "public domain (empty string clears)")
	uf.String("restart-policy", "", "docker restart policy")
	uf.String("healthcheck-path", "", "HTTP health check path")
	uf.String("cpu", "", "CPU limit (e.g. 0.5)")
	uf.String("memory", "", "memory limit (e.g. 512m)")
	uf.Int("replicas", 0, "replica count")
	uf.Int("port", 0, "container port")
	uf.StringArray("volume", nil, "named volume mount name:path[:ro] (repeatable, replaces all mounts)")
	uf.StringArray("bind", nil, "bind mount src:path[:ro] (repeatable)")
	uf.Bool("clear-volumes", false, "remove all volume mounts")
	uf.String("maintenance", "", "maintenance mode: on|off")
	uf.StringArray("basic-auth", nil, "basic-auth credential user:password (repeatable, replaces all)")
	uf.String("builder", "", "build strategy: auto|railpack|nixpacks|dockerfile|static")
	uf.String("cpu-reserve", "", "soft CPU reservation (empty clears)")
	uf.String("memory-reserve", "", "soft memory reservation (empty clears)")
	uf.String("static-cmd", "", "build command for the static builder (empty clears)")
	uf.String("static-dir", "", "output dir for the static builder (empty clears)")
	uf.Bool("sleep", false, "enable scale-to-zero on idle (sleep mode)")
	uf.Int("sleep-idle", 0, "idle minutes before sleeping (1-1440)")
	uf.StringArray("traefik-label", nil, "Traefik middleware override, key=value; repeatable; empty list clears via --traefik-label ''")
	uf.String("node", "", "pin to a node agent id, 'auto' for least-loaded, 'local' to clear")
	uf.Bool("spread", false, "spread replicas across all online schedulable nodes (--spread=false to disable)")
	uf.String("placement-tags", "", "comma-separated node tags required for remote placement (empty clears)")

	for _, a := range []string{"start", "stop", "restart", "redeploy", "sleep", "wake"} {
		verb := a
		ServicesCmd.AddCommand(&cobra.Command{
			Use:   verb + " <id>",
			Short: verb + " a service",
			Args:  cobra.ExactArgs(1),
			RunE:  serviceAction(verb),
		})
	}
	servicesCloneCmd.Flags().String("name", "", "name for the clone (default <name>-copy)")
	servicesCloneCmd.Flags().String("project", "", "target project id (default: same project)")
	servicesCloneCmd.Flags().String("environment", "", "target environment (default: source's)")

	domainsAddCmd.Flags().Bool("default", false, "set as the default domain")
	servicesDomainsCmd.AddCommand(domainsListCmd, domainsAddCmd, domainsRemoveCmd, domainsDefaultCmd, domainsCheckCmd)
	ServicesCmd.AddCommand(servicesListCmd, servicesGetCmd, servicesCreateCmd, servicesUpdateCmd, servicesDeleteCmd, servicesDomainsCmd, servicesCloneCmd, servicesMoveCmd, servicesEnvCheckCmd)
}

var servicesEnvCheckCmd = &cobra.Command{
	Use:   "env-check <id>",
	Short: "Diagnose service environment: empty vars, unresolved ${{refs}}",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		data, err := c.Do("GET", "/services/"+args[0]+"/env-check", nil)
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		m, _ := unwrapObject(data)
		if b, ok := m["ok"].(bool); ok && b {
			fmt.Println("env check: ok")
			return nil
		}
		for _, group := range []string{"unresolved", "empty", "unreadable"} {
			if list, ok := m[group].([]interface{}); ok {
				for _, item := range list {
					fmt.Printf("%s: %v\n", group, item)
				}
			}
		}
		return &APIError{Message: "env check failed", ExitCode: ExitError}
	},
}
