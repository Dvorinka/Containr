package api

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/deployment"
)

// Remote ingress: replicas on node agents aren't on the hub's
// containr-network, so Traefik's Docker provider can't see them. Instead
// the backend renders one file-provider config per service into
// TRAEFIK_DYNAMIC_DIR (a directory Traefik watches), pointing the
// loadbalancer at the node's reachable IP + the ephemeral host port the
// agent reported back after `create_container`.
//
// Empty dir → feature off (bare-metal dev). Files are best-effort: a
// failed write never fails a reconcile.

func ingressDir() string { return os.Getenv("TRAEFIK_DYNAMIC_DIR") }

func ingressFile(serviceID string) string {
	return filepath.Join(ingressDir(), "containr-"+serviceID+".yml")
}

// jsonInt coerces JSON-ish numbers (int/int32/int64/float64) to int —
// spec fields arrive as int32, agent payloads unmarshal as float64.
func jsonInt(v interface{}) int {
	switch n := v.(type) {
	case int:
		return n
	case int32:
		return int(n)
	case int64:
		return int(n)
	case float64:
		return int(n)
	}
	return 0
}

// reportedHostPorts parses the agent's create_container result —
// {"name": ..., "host_ports": {"80/tcp": "32768"}}. Older agents return a
// bare name string; JSON parse failure means no port info.
func reportedHostPorts(result string) map[string]string {
	var out struct {
		HostPorts map[string]string `json:"host_ports"`
	}
	if json.Unmarshal([]byte(result), &out) != nil {
		return nil
	}
	return out.HostPorts
}

// nodeIngressIP picks the address the hub can reach the node on. Mesh
// overlays first — the agent operator joined a mesh precisely so the hub
// can reach it — then the reported primary IP as a LAN fallback.
func nodeIngressIP(agent sqlcdb.NodeAgent) string {
	var meta struct {
		Mesh map[string]string `json:"mesh"`
	}
	_ = json.Unmarshal(agent.Metadata.RawMessage, &meta)
	for _, prefix := range []string{"tailscale", "netbird", "wg", "zt"} {
		var keys []string
		for name := range meta.Mesh {
			keys = append(keys, name)
		}
		sort.Strings(keys)
		for _, name := range keys {
			if strings.HasPrefix(name, prefix) && meta.Mesh[name] != "" {
				return meta.Mesh[name]
			}
		}
	}
	return agent.IpAddress
}

// syncRemoteIngress rewrites the service's file-provider config from the
// live remote replica set. Called after every remote reconcile so replica
// adds/removals and node retargets converge the upstream list.
func syncRemoteIngress(ctx context.Context, db *database.DB, spec deployment.RuntimeSpec) {
	if ingressDir() == "" {
		return
	}
	domains := spec.Domains
	if len(domains) == 0 && spec.Domain != "" {
		domains = []string{spec.Domain}
	}
	if len(domains) == 0 || spec.Port <= 0 {
		removeServiceIngress(spec.ServiceID)
		return
	}

	q := sqlcdb.New(db.DB)
	rows, err := q.ListServiceContainers(ctx, spec.ServiceID)
	if err != nil {
		return
	}
	type upstream struct{ ip, port string }
	var servers []upstream
	for _, row := range rows {
		var st struct {
			State string `json:"state"`
		}
		_ = json.Unmarshal(row.Status.RawMessage, &st)
		if st.State != "running" {
			continue
		}
		var port string
		var plist []map[string]interface{}
		if err := json.Unmarshal(row.Ports.RawMessage, &plist); err == nil {
			for _, p := range plist {
				if hp, ok := p["host_port"].(float64); ok && hp > 0 {
					port = fmt.Sprintf("%d", int(hp))
				}
			}
		}
		if port == "" {
			continue
		}
		agent, err := q.GetAgent(ctx, row.NodeAgentID)
		if err != nil {
			continue
		}
		if ip := nodeIngressIP(agent); ip != "" {
			servers = append(servers, upstream{ip, port})
		}
	}
	if len(servers) == 0 {
		removeServiceIngress(spec.ServiceID)
		return
	}

	router := "svc-" + spec.ServiceID[:8]
	rules := make([]string, 0, len(domains))
	for _, d := range domains {
		rules = append(rules, "Host(`"+d+"`)")
	}
	var b strings.Builder
	b.WriteString("http:\n  routers:\n    " + router + ":\n")
	b.WriteString("      rule: \"" + strings.Join(rules, " || ") + "\"\n")
	b.WriteString("      entrypoints: [web]\n")
	b.WriteString("      service: " + router + "\n")
	b.WriteString("  services:\n    " + router + ":\n      loadBalancer:\n        servers:\n")
	for _, s := range servers {
		b.WriteString("          - url: \"http://" + s.ip + ":" + s.port + "\"\n")
	}
	// Atomic-ish: write temp then rename so Traefik's watcher never reads a
	// truncated file.
	tmp := ingressFile(spec.ServiceID) + ".tmp"
	if err := os.WriteFile(tmp, []byte(b.String()), 0o644); err != nil {
		return
	}
	_ = os.Rename(tmp, ingressFile(spec.ServiceID))
}

// removeServiceIngress deletes the service's remote route. Called on
// remote teardown and when a service returns to local placement.
func removeServiceIngress(serviceID string) {
	if ingressDir() == "" {
		return
	}
	_ = os.Remove(ingressFile(serviceID))
}
