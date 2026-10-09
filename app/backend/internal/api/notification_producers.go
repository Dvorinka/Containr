package api

// Notification producers — the emitters behind `insertUserNotification`.
// Deployment success/failure lives in deployments.go; this file covers
// the remaining producers from the roadmap: admin fan-out helper, the
// agent offline/online sweep, and the upgrade-available check.

import (
	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Version is stamped at image build time via -ldflags "-X
// containr/internal/api.Version=…". "dev" disables the upgrade check.
var Version = "dev"

// notifyAdmins inserts a notification for every admin user. Best-effort.
func notifyAdmins(db *database.DB, kind, title, body, resourceType, resourceID string) {
	if db == nil {
		return
	}
	rows, err := db.Query(`SELECT id FROM users WHERE is_admin`)
	if err != nil {
		log.Printf("containr: notify admins lookup failed: %v", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err == nil {
			insertUserNotification(db, id.String(), kind, title, body, resourceType, resourceID)
		}
	}
}

// StartAgentHealthSweep marks agents offline when their heartbeat goes
// stale (and back online when it resumes), notifying admins on each
// transition. Heartbeats keep the row fresh via UpdateAgentHeartbeat.
func StartAgentHealthSweep(ctx context.Context, db *database.DB) {
	const staleAfter = 3 * time.Minute
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				reconcileAgentHealth(db, staleAfter)
			}
		}
	}()
}

type agentHealthRow struct {
	id        string
	name      string
	status    string
	stale     bool
	autoPrune bool
}

func reconcileAgentHealth(db *database.DB, staleAfter time.Duration) {
	cutoff := time.Now().Add(-staleAfter)
	var agents []agentHealthRow
	rows, err := db.Query(
		`SELECT id, COALESCE(name, hostname, id::text), COALESCE(status, ''),
		        COALESCE(last_heartbeat < $1, TRUE), auto_prune
		 FROM node_agents`, cutoff)
	if err != nil {
		log.Printf("containr: agent health sweep: %v", err)
		return
	}
	for rows.Next() {
		var a agentHealthRow
		if err := rows.Scan(&a.id, &a.name, &a.status, &a.stale, &a.autoPrune); err == nil {
			agents = append(agents, a)
		}
	}
	rows.Close()

	for _, a := range agents {
		switch {
		case a.stale && a.status != "offline":
			if _, err := db.Exec(
				`UPDATE node_agents SET status = 'offline', updated_at = NOW() WHERE id = $1`, a.id); err != nil {
				continue
			}
			notifyAdmins(db, "agent", "Node agent offline",
				fmt.Sprintf("Agent %s missed its heartbeat for over %s.", a.name, staleAfter), "agent", a.id)
		case !a.stale && a.status == "offline":
			if _, err := db.Exec(
				`UPDATE node_agents SET status = 'online', updated_at = NOW() WHERE id = $1`, a.id); err != nil {
				continue
			}
			notifyAdmins(db, "agent", "Node agent back online",
				fmt.Sprintf("Agent %s resumed heartbeating.", a.name), "agent", a.id)
		}
	}

	scheduleAutoPrune(db, agents)
}

// scheduleAutoPrune enqueues a `prune` command once per day for agents
// with auto_prune enabled. Disk pressure is the most common small-VPS
// failure — this is the dflow setServerAutoCleanup analog.
func scheduleAutoPrune(db *database.DB, agents []agentHealthRow) {
	q := sqlcdb.New(db.DB)
	for _, a := range agents {
		if !a.autoPrune || a.stale {
			continue
		}
		last, err := q.GetLastAgentCommandByType(context.Background(),
			sqlcdb.GetLastAgentCommandByTypeParams{NodeAgentID: a.id, Type: "prune"})
		if err == nil && last.CreatedAt.Valid && time.Since(last.CreatedAt.Time) < 24*time.Hour {
			continue
		}
		if _, err := q.CreateCommand(context.Background(), sqlcdb.CreateCommandParams{
			ID:          uuid.New().String(),
			Type:        "prune",
			NodeAgentID: a.id,
		}); err != nil {
			log.Printf("containr: auto-prune enqueue failed for agent %s: %v", a.id, err)
		}
	}
}

// StartUpgradeCheck polls GitHub for the latest release once a day and
// notifies admins when it is newer than the running version. The last
// notified tag is persisted in app_settings so restarts don't re-fire.
func StartUpgradeCheck(ctx context.Context, db *database.DB, currentVersion string) {
	if currentVersion == "" || currentVersion == "dev" {
		return
	}
	go func() {
		checkForUpgrade(db, currentVersion)
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				checkForUpgrade(db, currentVersion)
			}
		}
	}()
}

func checkForUpgrade(db *database.DB, currentVersion string) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.github.com/repos/Dvorinka/Containr/releases/latest", nil)
	if err != nil {
		return
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "containr-upgrade-check")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return
	}
	var release struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil || release.TagName == "" {
		return
	}
	if !semverNewer(release.TagName, currentVersion) {
		return
	}

	var lastNotified string
	_ = db.QueryRow(`SELECT value FROM app_settings WHERE key = 'upgrade_notified_tag'`).Scan(&lastNotified)
	if lastNotified == release.TagName {
		return
	}
	notifyAdmins(db, "upgrade", "Containr update available",
		fmt.Sprintf("Release %s is available (running %s). %s", release.TagName, currentVersion, release.HTMLURL),
		"release", release.TagName)
	_, _ = db.Exec(
		`INSERT INTO app_settings (key, value, updated_at) VALUES ('upgrade_notified_tag', $1, NOW())
		 ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, release.TagName)
}

// semverNewer reports whether candidate is a higher semver than current.
// Non-semver input (e.g. "dev", commit hashes) compares false.
func semverNewer(candidate, current string) bool {
	parse := func(s string) ([]int, bool) {
		s = strings.TrimPrefix(strings.TrimSpace(s), "v")
		// Prerelease/build metadata sorts after the same base version
		// upstream — for "is a newer release available" purposes the base
		// comparison is what matters.
		if j := strings.IndexAny(s, "-+"); j >= 0 {
			s = s[:j]
		}
		parts := strings.Split(s, ".")
		if len(parts) == 0 || len(parts) > 3 {
			return nil, false
		}
		out := make([]int, 3)
		for i, p := range parts {
			n, err := strconv.Atoi(p)
			if err != nil {
				return nil, false
			}
			out[i] = n
		}
		return out, true
	}
	c, ok1 := parse(candidate)
	cur, ok2 := parse(current)
	if !ok1 || !ok2 {
		return false
	}
	for i := 0; i < 3; i++ {
		if c[i] != cur[i] {
			return c[i] > cur[i]
		}
	}
	return false
}
