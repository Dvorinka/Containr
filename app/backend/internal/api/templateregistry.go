package api

// Template registry — CONTAINR_TEMPLATE_REGISTRY_URL points at another
// Containr instance (or any server answering the same template shape):
//   GET {base}/api/v1/templates     → {"templates": [ServiceTemplate…]}
//   GET {base}/api/v1/templates/:id → {"template": …, "config": …, "variables": …}
// Registry entries merge into the catalog as source:"registry"; deploying
// one materializes it as a user template for the deployer first. The
// bundled catalog always works offline — a dead registry never blocks it.

import (
	"containr/internal/database/sqlcdb"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
)

const registryCacheTTL = 60 * time.Second

var registryCache struct {
	mu        sync.Mutex
	fetchedAt time.Time
	templates []ServiceTemplate
}

func registryBaseURL() string {
	base := strings.TrimRight(strings.TrimSpace(os.Getenv("CONTAINR_TEMPLATE_REGISTRY_URL")), "/")
	base = strings.TrimSuffix(base, "/api/v1")
	return base
}

// fetchRegistryTemplates lists the remote catalog, cached for
// registryCacheTTL. Failures degrade to an empty list — never fatal.
func fetchRegistryTemplates(ctx context.Context) []ServiceTemplate {
	if registryBaseURL() == "" {
		return nil
	}
	registryCache.mu.Lock()
	fresh := time.Since(registryCache.fetchedAt) < registryCacheTTL && registryCache.templates != nil
	cached := registryCache.templates
	registryCache.mu.Unlock()
	if fresh {
		return cached
	}

	var templates []ServiceTemplate
	var payload struct {
		Templates []ServiceTemplate `json:"templates"`
	}
	if err := registryGet(ctx, "/api/v1/templates", &payload); err == nil {
		templates = payload.Templates
	}
	for i := range templates {
		templates[i].Source = "registry"
	}

	registryCache.mu.Lock()
	registryCache.fetchedAt = time.Now()
	registryCache.templates = templates
	registryCache.mu.Unlock()
	return templates
}

// fetchRegistryTemplate fetches one remote template's full document
// (template + config + variables). nil when the registry lacks it.
func fetchRegistryTemplate(ctx context.Context, id string) *ServiceTemplate {
	base := registryBaseURL()
	if base == "" {
		return nil
	}
	var payload struct {
		Template  ServiceTemplate    `json:"template"`
		Config    json.RawMessage    `json:"config"`
		Variables []TemplateVariable `json:"variables"`
	}
	if err := registryGet(ctx, "/api/v1/templates/"+id, &payload); err != nil {
		return nil
	}
	t := payload.Template
	if t.ID == "" {
		t.ID = id
	}
	t.Source = "registry"
	// The detail endpoint returns config/variables decoded; store them back
	// as raw JSON so they can persist unmodified into a local copy.
	if len(payload.Config) > 0 {
		t.Config = string(payload.Config)
	}
	if payload.Variables != nil {
		if raw, err := json.Marshal(payload.Variables); err == nil {
			t.Variables = string(raw)
		}
	}
	return &t
}

func registryGet(ctx context.Context, path string, out interface{}) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, registryBaseURL()+path, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return errRegistry{resp.StatusCode}
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

type errRegistry struct{ status int }

func (e errRegistry) Error() string { return "template registry status " + http.StatusText(e.status) }

// respondRegistryTemplate answers GET /templates/:id for a registry-only
// template with the same envelope shape as local templates.
func respondRegistryTemplate(c *gin.Context, t *ServiceTemplate) {
	config := json.RawMessage(t.Config)
	if len(config) == 0 {
		config = json.RawMessage(`{}`)
	}
	variables := json.RawMessage(t.Variables)
	if len(variables) == 0 {
		variables = json.RawMessage(`[]`)
	}
	c.JSON(http.StatusOK, gin.H{
		"template":  t,
		"config":    config,
		"variables": variables,
	})
}

// materializeRegistryTemplate copies a registry template into the local
// catalog as a private template owned by the deployer, so the normal
// deploy path (and future re-deploys) work without the registry. The
// local id is deterministic per (registry, template, user) so repeat
// deploys reuse the same copy instead of accumulating duplicates.
func materializeRegistryTemplate(c *gin.Context, q *sqlcdb.Queries, userID, templateID string) (sqlcdb.ServiceTemplate, error) {
	ownerUUID, err := uuid.Parse(userID)
	if err != nil {
		return sqlcdb.ServiceTemplate{}, err
	}
	sum := sha256.Sum256([]byte(registryBaseURL() + "|" + templateID + "|" + userID))
	localID := "reg-" + hex.EncodeToString(sum[:8])
	if existing, err := q.GetServiceTemplateByID(c.Request.Context(), localID); err == nil {
		return existing, nil
	}

	rt := fetchRegistryTemplate(c.Request.Context(), templateID)
	if rt == nil {
		return sqlcdb.ServiceTemplate{}, sql.ErrNoRows
	}
	variables := pqtype.NullRawMessage{}
	if rt.Variables != "" {
		variables = pqtype.NullRawMessage{RawMessage: json.RawMessage(rt.Variables), Valid: true}
	}
	if err := q.CreateUserTemplate(c.Request.Context(), sqlcdb.CreateUserTemplateParams{
		ID:          localID,
		Name:        rt.Name,
		Description: nullableText(rt.Description),
		Category:    rt.Category,
		Logo:        nullableText(rt.Logo),
		Config:      json.RawMessage(rt.Config),
		Variables:   variables,
		OwnerID:     uuid.NullUUID{UUID: ownerUUID, Valid: true},
		IsPublic:    false,
	}); err != nil {
		return sqlcdb.ServiceTemplate{}, err
	}
	return q.GetServiceTemplateByID(c.Request.Context(), localID)
}
