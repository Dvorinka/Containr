package api

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/deployment"
	"containr/internal/deployqueue"
	"containr/internal/secrets"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

// TemplateServiceSpec describes one member of a multi-service (v2) template
// graph. A graph template carries services[] on TemplateConfig; legacy
// templates keep the flat single-service fields and are untouched by this
// path.
type TemplateServiceSpec struct {
	Key          string            `json:"key"`
	Name         string            `json:"name,omitempty"`
	Type         string            `json:"type"` // web | worker | cron | database
	Runtime      string            `json:"runtime,omitempty"`
	Repo         string            `json:"repo,omitempty"`
	Branch       string            `json:"branch,omitempty"`
	BuildCommand string            `json:"build_command,omitempty"`
	StartCommand string            `json:"start_command,omitempty"`
	Port         int               `json:"port,omitempty"`
	HealthCheck  string            `json:"health_check,omitempty"`
	Builder      string            `json:"builder,omitempty"`
	Environment  map[string]string `json:"environment,omitempty"`
	Volumes      []ServiceVolume   `json:"volumes,omitempty"`
	DependsOn    []string          `json:"depends_on,omitempty"`
}

var (
	tmplExprService = regexp.MustCompile(`\{\{\s*service\.([A-Za-z0-9_-]+)\.([a-z_]+)\s*\}\}`)
	tmplExprSecret  = regexp.MustCompile(`\{\{\s*secret(?:\((\d+)\))?\s*\}\}`)
	tmplExprRandom  = regexp.MustCompile(`\{\{\s*random:(\d+)\s*\}\}`)
	tmplExprVar     = regexp.MustCompile(`\{\{\s*([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\s*\}\}`)
	tmplKeyValid    = regexp.MustCompile(`^[a-z][a-z0-9_-]*$`)
)

// databaseRefSpec maps a managed-database engine to the env keys its
// provisioning plan reads, the internal port and the URL scheme used when
// another member references it via {{service.<key>.url}}.
type databaseRefSpec struct {
	userKey string
	passKey string
	dbKey   string
	scheme  string
	port    int
	// defUser mirrors the fallback used by buildDatabaseRuntimePlan so refs
	// resolve to the same value the container ends up with.
	defUser string
}

var databaseRefSpecs = map[string]databaseRefSpec{
	"postgresql": {userKey: "POSTGRES_USER", passKey: "POSTGRES_PASSWORD", dbKey: "POSTGRES_DB", scheme: "postgresql", port: 5432, defUser: "app"},
	"redis":      {passKey: "REDIS_PASSWORD", scheme: "redis", port: 6379, defUser: "default"},
	"dragonfly":  {passKey: "DRAGONFLY_PASSWORD", scheme: "redis", port: 6379, defUser: "default"},
	"mysql":      {userKey: "MYSQL_USER", passKey: "MYSQL_PASSWORD", dbKey: "MYSQL_DATABASE", scheme: "mysql", port: 3306, defUser: "app"},
	"mariadb":    {userKey: "MARIADB_USER", passKey: "MARIADB_PASSWORD", dbKey: "MARIADB_DATABASE", scheme: "mysql", port: 3306, defUser: "app"},
	"mongodb":    {userKey: "MONGO_INITDB_ROOT_USERNAME", passKey: "MONGO_INITDB_ROOT_PASSWORD", dbKey: "MONGO_INITDB_DATABASE", scheme: "mongodb", port: 27017, defUser: "admin"},
	"clickhouse": {userKey: "CLICKHOUSE_USER", passKey: "CLICKHOUSE_PASSWORD", dbKey: "CLICKHOUSE_DB", scheme: "http", port: 8123, defUser: "default"},
}

// normalizeGraphAlias turns a member key into a DNS-safe network alias.
func normalizeGraphAlias(key string) string {
	alias := strings.ToLower(strings.TrimSpace(key))
	var b strings.Builder
	for _, r := range alias {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-':
			b.WriteRune(r)
		default:
			b.WriteRune('-')
		}
	}
	return strings.Trim(b.String(), "-")
}

// topoSortServices orders graph members so every depends_on edge resolves
// before its dependent. Returns an error on cycles or unknown keys.
func topoSortServices(specs []TemplateServiceSpec) ([]TemplateServiceSpec, error) {
	byKey := make(map[string]TemplateServiceSpec, len(specs))
	for _, s := range specs {
		key := normalizeGraphAlias(s.Key)
		if key == "" || !tmplKeyValid.MatchString(key) {
			return nil, fmt.Errorf("invalid service key %q — use lowercase letters, digits, '-' or '_'", s.Key)
		}
		if _, dup := byKey[key]; dup {
			return nil, fmt.Errorf("duplicate service key %q", key)
		}
		s.Key = key
		byKey[key] = s
	}

	indegree := make(map[string]int, len(byKey))
	for key := range byKey {
		indegree[key] = 0
	}
	for key, s := range byKey {
		for _, dep := range s.DependsOn {
			d := normalizeGraphAlias(dep)
			if _, ok := byKey[d]; !ok {
				return nil, fmt.Errorf("service %q depends on unknown key %q", key, dep)
			}
			if d == key {
				return nil, fmt.Errorf("service %q depends on itself", key)
			}
			indegree[key]++
		}
	}

	var ready []string
	for key, deg := range indegree {
		if deg == 0 {
			ready = append(ready, key)
		}
	}
	// Deterministic order: keep declaration order for equal in-degrees.
	declOrder := make(map[string]int, len(specs))
	for i, s := range specs {
		declOrder[normalizeGraphAlias(s.Key)] = i
	}
	sortKeys := func(keys []string) {
		for i := 1; i < len(keys); i++ {
			for j := i; j > 0 && declOrder[keys[j]] < declOrder[keys[j-1]]; j-- {
				keys[j], keys[j-1] = keys[j-1], keys[j]
			}
		}
	}
	sortKeys(ready)

	var sorted []TemplateServiceSpec
	for len(ready) > 0 {
		key := ready[0]
		ready = ready[1:]
		sorted = append(sorted, byKey[key])
		for other, s := range byKey {
			for _, dep := range s.DependsOn {
				if normalizeGraphAlias(dep) == key {
					indegree[other]--
					if indegree[other] == 0 {
						ready = append(ready, other)
					}
				}
			}
		}
		sortKeys(ready)
	}

	if len(sorted) != len(byKey) {
		return nil, fmt.Errorf("service dependency graph contains a cycle")
	}
	return sorted, nil
}

// generatedSecrets records which member/key pairs received a generated
// secret so the value can be persisted with is_secret=true.
type resolvedGraph struct {
	members    []resolvedMember
	unresolved []string
}

type resolvedMember struct {
	spec       TemplateServiceSpec
	env        map[string]string
	secretKeys map[string]bool
}

func generateSecretHex(n int) string {
	if n <= 0 || n > 128 {
		n = 16
	}
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return ""
	}
	return hex.EncodeToString(buf)
}

// resolveStaticExpr expands {{secret}}, {{secret(N)}}, {{random:N}}, {{VAR}}
// and {{VAR:-default}} within a single value. Unknown vars without defaults
// are recorded in unresolved.
func resolveStaticExpr(value string, userVars map[string]string, unresolved *[]string, generated *bool) string {
	v := tmplExprSecret.ReplaceAllStringFunc(value, func(m string) string {
		if generated != nil {
			*generated = true
		}
		sub := tmplExprSecret.FindStringSubmatch(m)
		n, _ := strconv.Atoi(sub[1])
		return generateSecretHex(n)
	})
	v = tmplExprRandom.ReplaceAllStringFunc(v, func(m string) string {
		sub := tmplExprRandom.FindStringSubmatch(m)
		max, err := strconv.ParseInt(sub[1], 10, 64)
		if err != nil || max <= 0 {
			return m
		}
		n, err := rand.Int(rand.Reader, big.NewInt(max))
		if err != nil {
			return m
		}
		return n.String()
	})
	v = tmplExprVar.ReplaceAllStringFunc(v, func(m string) string {
		sub := tmplExprVar.FindStringSubmatch(m)
		key := sub[1]
		if val, ok := userVars[key]; ok {
			return val
		}
		if sub[2] != "" {
			return sub[2]
		}
		if unresolved != nil {
			*unresolved = append(*unresolved, key)
		}
		return ""
	})
	return v
}

// resolveTemplateGraph performs the two-pass resolution: pass 1 expands
// static expressions per member; pass 2 builds the per-service property
// table (host/port/url/credentials) and expands {{service.KEY.prop}}.
func resolveTemplateGraph(sorted []TemplateServiceSpec, userVars map[string]string) resolvedGraph {
	graph := resolvedGraph{members: make([]resolvedMember, 0, len(sorted)), unresolved: []string{}}

	// Pass 1: static expressions. Database members get their credential
	// keys pre-filled so {{service.db.password}} always resolves — the same
	// value is then passed to the engine's own env vars at provisioning.
	for _, spec := range sorted {
		env := map[string]string{}
		for k, v := range spec.Environment {
			env[k] = v
		}
		if normalizeTemplateMemberType(spec) == "database" {
			engine := normalizeDatabaseType(spec.Runtime)
			if ref, ok := databaseRefSpecs[engine]; ok {
				if ref.passKey != "" && strings.TrimSpace(env[ref.passKey]) == "" {
					env[ref.passKey] = "{{secret}}"
				}
			}
		}
		member := resolvedMember{spec: spec, env: map[string]string{}, secretKeys: map[string]bool{}}
		for k, v := range env {
			generated := false
			resolved := resolveStaticExpr(v, userVars, &graph.unresolved, &generated)
			member.env[k] = resolved
			if generated {
				member.secretKeys[k] = true
			}
		}
		graph.members = append(graph.members, member)
	}

	// Pass 2: property tables.
	propTables := make(map[string]map[string]string, len(sorted))
	for _, m := range graph.members {
		props := map[string]string{}
		if normalizeTemplateMemberType(m.spec) == "database" {
			engine := normalizeDatabaseType(m.spec.Runtime)
			ref := databaseRefSpecs[engine]
			alias := m.spec.Key
			dbName := m.spec.Name
			if dbName == "" {
				dbName = m.spec.Key
			}
			user := ""
			if ref.userKey != "" {
				user = m.env[ref.userKey]
				if user == "" {
					user = ref.defUser
				}
			}
			password := ""
			if ref.passKey != "" {
				password = m.env[ref.passKey]
			}
			database := ""
			if ref.dbKey != "" {
				database = m.env[ref.dbKey]
				if database == "" {
					database = dbName
				}
			}
			user = sanitizeDBIdentifier(user, ref.defUser)
			database = sanitizeDBIdentifier(database, "app")

			props["host"] = alias
			props["port"] = strconv.Itoa(ref.port)
			if user != "" {
				props["user"] = user
				props["username"] = user
			}
			if password != "" {
				props["password"] = password
			}
			if database != "" {
				props["database"] = database
				props["db"] = database
			}
			url := graphDatabaseURL(ref, user, password, alias, database)
			if url != "" {
				props["url"] = url
				props["connection_url"] = url
			}
		} else {
			name := m.spec.Name
			if name == "" {
				name = m.spec.Key
			}
			host := normalizeGraphAlias(name)
			props["host"] = host
			if m.spec.Port > 0 {
				props["port"] = strconv.Itoa(m.spec.Port)
				props["url"] = fmt.Sprintf("http://%s:%d", host, m.spec.Port)
			}
		}
		propTables[m.spec.Key] = props
	}

	for i := range graph.members {
		m := &graph.members[i]
		for k, v := range m.env {
			m.env[k] = tmplExprService.ReplaceAllStringFunc(v, func(match string) string {
				sub := tmplExprService.FindStringSubmatch(match)
				refKey := normalizeGraphAlias(sub[1])
				prop := sub[2]
				if props, ok := propTables[refKey]; ok {
					if val, ok := props[prop]; ok {
						// Credential-bearing refs mark the consuming key
						// secret so it stores encrypted and masks in plan.
						if prop == "password" || prop == "url" || prop == "connection_url" {
							m.secretKeys[k] = true
						}
						return val
					}
				}
				graph.unresolved = append(graph.unresolved, fmt.Sprintf("service.%s.%s", refKey, prop))
				return match
			})
		}
	}

	return graph
}

func graphDatabaseURL(ref databaseRefSpec, user, password, host, database string) string {
	port := strconv.Itoa(ref.port)
	switch ref.scheme {
	case "redis":
		// redis://[:password@]host:port/0 — user slot stays "default" for
		// clients that require it.
		u := user
		if u == "" {
			u = "default"
		}
		return fmt.Sprintf("redis://%s:%s@%s:%s/0", u, password, host, port)
	case "mysql":
		return fmt.Sprintf("mysql://%s:%s@%s:%s/%s", user, password, host, port, database)
	case "mongodb":
		return fmt.Sprintf("mongodb://%s:%s@%s:%s/%s", user, password, host, port, database)
	case "http":
		return fmt.Sprintf("http://%s:%s@%s:%s/%s", user, password, host, port, database)
	default:
		return fmt.Sprintf("postgresql://%s:%s@%s:%s/%s?sslmode=disable", user, password, host, port, database)
	}
}

func normalizeTemplateMemberType(spec TemplateServiceSpec) string {
	t, err := normalizeTemplateServiceType(spec.Type)
	if err != nil {
		return "web"
	}
	return t
}

// validateTemplateGraph checks member shapes that topo sort and resolution
// don't cover: supported types, image/runtime presence, database engines.
func validateTemplateGraph(sorted []TemplateServiceSpec) error {
	for _, spec := range sorted {
		t := normalizeTemplateMemberType(spec)
		if t == "database" {
			engine := normalizeDatabaseType(spec.Runtime)
			if _, ok := supportedDatabaseTypes[engine]; !ok {
				return fmt.Errorf("service %q: unsupported database type %q", spec.Key, spec.Runtime)
			}
			continue
		}
		if strings.TrimSpace(spec.Runtime) == "" && strings.TrimSpace(spec.Repo) == "" {
			return fmt.Errorf("service %q: needs a runtime (image) or repo", spec.Key)
		}
	}
	return nil
}

// ---- Plan endpoint --------------------------------------------------------

type templatePlanMember struct {
	Key         string            `json:"key"`
	Name        string            `json:"name"`
	Type        string            `json:"type"`
	Runtime     string            `json:"runtime,omitempty"`
	Port        int               `json:"port,omitempty"`
	DependsOn   []string          `json:"depends_on,omitempty"`
	Environment map[string]string `json:"environment"`
}

// handlePlanTemplate dry-resolves a template (v1 or v2): variable merging,
// expression expansion and service refs, without creating anything.
// Generated secrets are shown masked — deploy regenerates them.
func handlePlanTemplate(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)
	ctx := c.Request.Context()

	var req struct {
		ProjectID string            `json:"project_id"`
		Variables map[string]string `json:"variables"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_ = userID

	templateRow, err := queries.GetServiceTemplateByID(ctx, c.Param("id"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch template"})
		return
	}
	template := mapSQLCTemplate(templateRow)
	if template.ID == "" || !templateVisibleTo(c, template) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	var config TemplateConfig
	if err := json.Unmarshal([]byte(template.Config), &config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Template configuration is invalid"})
		return
	}
	var templateVars []TemplateVariable
	_ = json.Unmarshal([]byte(template.Variables), &templateVars)

	varsByKey := map[string]TemplateVariable{}
	for _, v := range templateVars {
		varsByKey[v.Key] = v
	}
	userVars := map[string]string{}
	for _, v := range templateVars {
		if req.Variables != nil {
			if override, ok := req.Variables[v.Key]; ok {
				userVars[v.Key] = override
				continue
			}
		}
		if v.Default != "" {
			userVars[v.Key] = v.Default
		}
	}
	for k, v := range req.Variables {
		userVars[k] = v
	}

	missing := []string{}
	for _, v := range templateVars {
		if v.Required && strings.TrimSpace(userVars[v.Key]) == "" {
			missing = append(missing, v.Key)
		}
	}

	maskSecrets := func(env map[string]string, member resolvedMember) map[string]string {
		out := map[string]string{}
		for k, v := range env {
			if member.secretKeys[k] || (varsByKey[k].Secret) {
				out[k] = "********"
			} else {
				out[k] = v
			}
		}
		return out
	}

	if len(config.Services) == 0 {
		env, secretKeys, missingReq := mergeTemplateVariables(config.Environment, templateVars, req.Variables)
		resolved := resolvedMember{
			spec:       TemplateServiceSpec{Key: "service", Type: config.Type, Runtime: config.Runtime, Port: config.Port},
			env:        env,
			secretKeys: secretKeys,
		}
		c.JSON(http.StatusOK, gin.H{
			"members": []templatePlanMember{{
				Key:         "service",
				Type:        config.Type,
				Runtime:     config.Runtime,
				Port:        config.Port,
				Environment: maskSecrets(resolved.env, resolved),
			}},
			"missing_variables": missingReq,
			"unresolved":        []string{},
		})
		return
	}

	sorted, err := topoSortServices(config.Services)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateTemplateGraph(sorted); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	graph := resolveTemplateGraph(sorted, userVars)
	members := make([]templatePlanMember, 0, len(graph.members))
	for _, m := range graph.members {
		name := m.spec.Name
		if name == "" {
			name = m.spec.Key
		}
		members = append(members, templatePlanMember{
			Key:         m.spec.Key,
			Name:        name,
			Type:        normalizeTemplateMemberType(m.spec),
			Runtime:     m.spec.Runtime,
			Port:        m.spec.Port,
			DependsOn:   m.spec.DependsOn,
			Environment: maskSecrets(m.env, m),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"members":           members,
		"missing_variables": missing,
		"unresolved":        graph.unresolved,
	})
}

// ---- Graph deploy ---------------------------------------------------------

type graphCreatedResource struct {
	Key          string `json:"key"`
	Kind         string `json:"kind"` // service | database
	ID           string `json:"id"`
	Name         string `json:"name"`
	DeploymentID string `json:"deployment_id,omitempty"`
}

// deployTemplateGraph runs a resolved graph against a project: databases
// first (async provision + project-network alias), then services, then
// per-service deploy jobs. Partial failure removes rows/containers created
// by this call.
func deployTemplateGraph(
	c *gin.Context,
	db *database.DB,
	engine *deployment.DeploymentEngine,
	dbHandler *DatabaseHandler,
	projectID uuid.UUID,
	userID string,
	specs []TemplateServiceSpec,
	templateVars []TemplateVariable,
	userVars map[string]string,
	plan, region string,
	source string,
) ([]graphCreatedResource, *gin.H) {
	sorted, err := topoSortServices(specs)
	if err != nil {
		return nil, &gin.H{"error": err.Error()}
	}
	if err := validateTemplateGraph(sorted); err != nil {
		return nil, &gin.H{"error": err.Error()}
	}

	missing := []string{}
	for _, v := range templateVars {
		if v.Required && strings.TrimSpace(userVars[v.Key]) == "" {
			missing = append(missing, v.Key)
		}
	}
	if len(missing) > 0 {
		return nil, &gin.H{
			"error":             fmt.Sprintf("Missing required template variables: %s", strings.Join(missing, ", ")),
			"missing_variables": missing,
		}
	}

	graph := resolveTemplateGraph(sorted, userVars)
	if len(graph.unresolved) > 0 {
		return nil, &gin.H{
			"error":      fmt.Sprintf("Unresolved template references: %s", strings.Join(dedupStrings(graph.unresolved), ", ")),
			"unresolved": dedupStrings(graph.unresolved),
		}
	}

	queries := sqlcdb.New(db.DB)
	ctx := c.Request.Context()

	if engine != nil {
		// Project network must exist before database containers attach.
		if _, err := engine.EnsureProjectNetwork(ctx, projectID.String()); err != nil {
			log.Printf("containr: template deploy: ensure project network: %v", err)
		}
	}

	created := []graphCreatedResource{}
	createdServiceIDs := []uuid.UUID{}
	createdDatabaseIDs := []string{}
	cleanup := func() {
		for _, sid := range createdServiceIDs {
			if engine != nil {
				removeServiceRuntime(context.Background(), db, engine, sid)
			}
			_, _ = db.Exec(`DELETE FROM environment_variables WHERE service_id = $1`, sid)
			_, _ = db.Exec(`DELETE FROM services WHERE id = $1`, sid)
		}
		for _, did := range createdDatabaseIDs {
			if dbHandler != nil && dbHandler.dockerClient != nil {
				_ = dbHandler.dockerClient.RemoveContainer(context.Background(), managedDatabaseContainerName(did), true)
				_ = dbHandler.dockerClient.RemoveVolume(context.Background(), managedDatabaseVolumeName(did), true)
			}
			_, _ = db.Exec(`DELETE FROM database_services WHERE id = $1`, did)
		}
	}

	secretTemplateKeys := map[string]bool{}
	for _, v := range templateVars {
		if v.Secret {
			secretTemplateKeys[v.Key] = true
		}
	}

	for _, m := range graph.members {
		memberName := strings.TrimSpace(m.spec.Name)
		if memberName == "" {
			memberName = m.spec.Key
		}
		memberType := normalizeTemplateMemberType(m.spec)

		if memberType == "database" {
			if dbHandler == nil {
				cleanup()
				return nil, &gin.H{"error": "Database handler unavailable"}
			}
			databaseID, err := dbHandler.createManagedDatabaseAndProvision(ctx, userID, managedDatabaseCreateRequest{
				Name:             memberName,
				Type:             m.spec.Runtime,
				Plan:             plan,
				Region:           region,
				RuntimeVariables: m.env,
				ProjectID:        projectID.String(),
				NetworkAlias:     m.spec.Key,
			})
			if err != nil {
				cleanup()
				switch {
				case errors.Is(err, errDatabaseNameRequired), errors.Is(err, errUnsupportedDatabaseType), errors.Is(err, errUnsupportedDatabasePlan):
					return nil, &gin.H{"error": err.Error()}
				case errors.Is(err, errDatabaseNameAlreadyInUse):
					return nil, &gin.H{"error": err.Error(), "code": "CONFLICT"}
				default:
					return nil, &gin.H{"error": "Failed to create managed database: " + err.Error()}
				}
			}
			createdDatabaseIDs = append(createdDatabaseIDs, databaseID)
			created = append(created, graphCreatedResource{Key: m.spec.Key, Kind: "database", ID: databaseID, Name: memberName})
			LogAudit(userID, "database", databaseID, "create", map[string]interface{}{
				"source": source, "name": memberName, "type": normalizeDatabaseType(m.spec.Runtime), "project_id": projectID.String(),
			})
			continue
		}

		count, err := queries.CountServicesByProjectAndName(ctx, sqlcdb.CountServicesByProjectAndNameParams{
			ProjectID: projectID,
			Name:      memberName,
		})
		if err != nil {
			cleanup()
			return nil, &gin.H{"error": "Failed to validate service name"}
		}
		if count > 0 {
			cleanup()
			return nil, &gin.H{"error": fmt.Sprintf("Service name %q already exists in this project", memberName), "code": "CONFLICT"}
		}

		serviceImage := resolveTemplateRuntimeImage(m.spec.Runtime)
		serviceCommand := strings.TrimSpace(m.spec.StartCommand)
		buildCommand := strings.TrimSpace(m.spec.BuildCommand)
		cpu, memory := defaultTemplateResources(memberType)

		environmentID, err := getProjectEnvironmentID(db, projectID, "production")
		if err != nil {
			cleanup()
			return nil, &gin.H{"error": "Failed to resolve service environment"}
		}

		serviceID := uuid.New()
		now := time.Now()

		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			cleanup()
			return nil, &gin.H{"error": "Failed to initialize service"}
		}
		txQueries := queries.WithTx(tx)
		err = txQueries.CreateServiceFromTemplate(ctx, sqlcdb.CreateServiceFromTemplateParams{
			ID:            serviceID,
			ProjectID:     projectID,
			Name:          memberName,
			EnvironmentID: environmentID,
			ServiceType:   memberType,
			SourceType:    "template",
			ImageName:     sql.NullString{String: serviceImage, Valid: serviceImage != ""},
			BuildCommand:  sql.NullString{String: buildCommand, Valid: buildCommand != ""},
			StartCommand:  sql.NullString{String: serviceCommand, Valid: serviceCommand != ""},
			Type:          sql.NullString{String: memberType, Valid: true},
			Status:        sql.NullString{String: "stopped", Valid: true},
			Image:         sql.NullString{String: serviceImage, Valid: serviceImage != ""},
			Command:       sql.NullString{String: serviceCommand, Valid: serviceCommand != ""},
			Environment:   sql.NullString{String: "production", Valid: true},
			Cpu:           sql.NullString{String: cpu, Valid: true},
			Memory:        sql.NullString{String: memory, Valid: true},
			CreatedAt:     sql.NullTime{Time: now, Valid: true},
			UpdatedAt:     sql.NullTime{Time: now, Valid: true},
		})
		if err != nil {
			tx.Rollback()
			cleanup()
			return nil, &gin.H{"error": "Failed to create service"}
		}

		var volumesJSON interface{}
		if len(m.spec.Volumes) > 0 {
			if raw, err := json.Marshal(m.spec.Volumes); err == nil {
				volumesJSON = string(raw)
			}
		}
		builder := strings.TrimSpace(m.spec.Builder)
		if builder == "" {
			builder = "auto"
		}
		if _, err = tx.ExecContext(ctx,
			`UPDATE services SET port = $1, healthcheck_path = $2, volumes = COALESCE($3::jsonb, '[]'::jsonb),
			        git_repo = NULLIF($4, ''), git_branch = NULLIF($5, ''), builder = $6
			 WHERE id = $7`,
			m.spec.Port, strings.TrimSpace(m.spec.HealthCheck), volumesJSON,
			strings.TrimSpace(m.spec.Repo), strings.TrimSpace(m.spec.Branch), builder,
			serviceID,
		); err != nil {
			tx.Rollback()
			cleanup()
			return nil, &gin.H{"error": "Failed to configure service"}
		}

		for key, value := range m.env {
			if strings.TrimSpace(key) == "" {
				continue
			}
			isSecret := m.secretKeys[key] || secretTemplateKeys[key]
			stored := value
			if isSecret {
				stored = secrets.Encrypt(value)
			}
			if err = txQueries.UpsertEnvironmentVariable(ctx, sqlcdb.UpsertEnvironmentVariableParams{
				ID:        uuid.New(),
				ServiceID: serviceID,
				Key:       key,
				Value:     stored,
				IsSecret:  sql.NullBool{Bool: isSecret, Valid: true},
				CreatedAt: sql.NullTime{Time: now, Valid: true},
				UpdatedAt: sql.NullTime{Time: now, Valid: true},
			}); err != nil {
				tx.Rollback()
				cleanup()
				return nil, &gin.H{"error": "Failed to save service variables"}
			}
		}

		if err := tx.Commit(); err != nil {
			cleanup()
			return nil, &gin.H{"error": "Failed to finalize service"}
		}
		createdServiceIDs = append(createdServiceIDs, serviceID)

		res := graphCreatedResource{Key: m.spec.Key, Kind: "service", ID: serviceID.String(), Name: memberName}

		if engine != nil {
			service := Service{
				ID:              serviceID,
				ProjectID:       projectID,
				Name:            memberName,
				Type:            memberType,
				Status:          "building",
				Image:           serviceImage,
				Command:         serviceCommand,
				Environment:     "production",
				GitRepo:         strings.TrimSpace(m.spec.Repo),
				GitBranch:       strings.TrimSpace(m.spec.Branch),
				Replicas:        1,
				Port:            m.spec.Port,
				HealthCheckPath: strings.TrimSpace(m.spec.HealthCheck),
				RestartPolicy:   "unless-stopped",
				Builder:         builder,
			}
			depID := queueTemplateDeployment(c, db, engine, service, userID)
			if depID != uuid.Nil {
				res.DeploymentID = depID.String()
			}
		}

		created = append(created, res)
		LogAudit(userID, "service", serviceID.String(), "create", map[string]interface{}{
			"source": source, "name": memberName, "type": memberType,
		})
	}

	return created, nil
}

// queueTemplateDeployment creates a deployment row and enqueues the shared
// build+run job — the same path a manual POST /deployments takes.
func queueTemplateDeployment(c *gin.Context, db *database.DB, engine *deployment.DeploymentEngine, service Service, userID string) uuid.UUID {
	now := time.Now()
	dep := DeploymentModel{
		ID:        uuid.New(),
		ServiceID: service.ID,
		Status:    "queued",
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := db.Exec(
		`INSERT INTO deployments
		 (id, service_id, version, commit_hash, status, image_name, image_tag, created_at, updated_at)
		 VALUES ($1, $2, $3, NULL, $4, '', '', $5, $6)`,
		dep.ID, dep.ServiceID, fmt.Sprintf("v%d", now.Unix()), dep.Status, dep.CreatedAt, dep.UpdatedAt,
	); err != nil {
		return uuid.Nil
	}
	_, _ = db.Exec(`UPDATE services SET status = 'queued', updated_at = $1 WHERE id = $2`, time.Now(), service.ID)

	getDeployQueue(c).Enqueue(service.ID, deployqueue.Job{
		DeploymentID: dep.ID,
		Run: func(jctx context.Context) {
			runDeploymentAndSync(jctx, db, engine, &dep, service, CreateDeploymentRequest{Trigger: "template"}, userID)
		},
	})
	return dep.ID
}

// handleDeployInlineGraph deploys an ad-hoc service graph without a stored
// template — the companion to compose import: import returns a config,
// this deploys it.
func handleDeployInlineGraph(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	ctx := c.Request.Context()

	var req struct {
		ProjectID string `json:"project_id" binding:"required"`
		Config    struct {
			Services []TemplateServiceSpec `json:"services"`
		} `json:"config" binding:"required"`
		Variables map[string]string `json:"variables"`
		Plan      string            `json:"plan"`
		Region    string            `json:"region"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Config.Services) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "config.services is empty"})
		return
	}

	projectID, err := uuid.Parse(strings.TrimSpace(req.ProjectID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	queries := sqlcdb.New(db.DB)
	ownerID, err := queries.GetProjectOwnerID(ctx, projectID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch project"})
		return
	}
	if ownerID.String() != userID && !contextIsAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var engine *deployment.DeploymentEngine
	if v, exists := c.Get("deployment_engine"); exists && v != nil {
		engine, _ = v.(*deployment.DeploymentEngine)
	}
	var dbHandler *DatabaseHandler
	if v, exists := c.Get("database_handler"); exists {
		dbHandler, _ = v.(*DatabaseHandler)
	}

	created, fail := deployTemplateGraph(c, db, engine, dbHandler, projectID, userID,
		req.Config.Services, nil, req.Variables, req.Plan, req.Region, "inline")
	if fail != nil {
		status := http.StatusBadRequest
		if (*fail)["code"] == "CONFLICT" {
			status = http.StatusConflict
		}
		c.JSON(status, *fail)
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"resource": "stack",
		"created":  created,
	})
}

// handleImportProjectCompose deploys a docker-compose file straight into a
// project — parse → graph specs → deployTemplateGraph, no template row.
func handleImportProjectCompose(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	ctx := c.Request.Context()

	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	queries := sqlcdb.New(db.DB)
	ownerID, err := queries.GetProjectOwnerID(ctx, projectID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch project"})
		return
	}
	if ownerID.String() != userID && !contextIsAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var req struct {
		ComposeYAML string            `json:"compose_yaml" binding:"required"`
		Variables   map[string]string `json:"variables"`
		Plan        string            `json:"plan"`
		Region      string            `json:"region"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.ComposeYAML) > 512*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Compose file exceeds 512 KiB"})
		return
	}

	var file composeFileDef
	if err := yaml.Unmarshal([]byte(req.ComposeYAML), &file); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid compose YAML: " + err.Error()})
		return
	}
	specs, warnings, convErr := composeToSpecs(&file)
	if convErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": convErr.Error()})
		return
	}

	var engine *deployment.DeploymentEngine
	if v, exists := c.Get("deployment_engine"); exists && v != nil {
		engine, _ = v.(*deployment.DeploymentEngine)
	}
	var dbHandler *DatabaseHandler
	if v, exists := c.Get("database_handler"); exists {
		dbHandler, _ = v.(*DatabaseHandler)
	}

	created, fail := deployTemplateGraph(c, db, engine, dbHandler, projectID, userID,
		specs, nil, req.Variables, req.Plan, req.Region, "compose-import")
	if fail != nil {
		status := http.StatusBadRequest
		if (*fail)["code"] == "CONFLICT" {
			status = http.StatusConflict
		}
		c.JSON(status, *fail)
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"resource": "stack",
		"created":  created,
		"warnings": warnings,
	})
}

func dedupStrings(in []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, s := range in {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

// ---- Compose import --------------------------------------------------------

type composeServiceDef struct {
	Image       string        `yaml:"image"`
	Build       interface{}   `yaml:"build"`
	Command     interface{}   `yaml:"command"`
	Entrypoint  interface{}   `yaml:"entrypoint"`
	Environment interface{}   `yaml:"environment"`
	Ports       []interface{} `yaml:"ports"`
	DependsOn   interface{}   `yaml:"depends_on"`
	Volumes     []interface{} `yaml:"volumes"`
	Restart     string        `yaml:"restart"`
}

type composeFileDef struct {
	Services map[string]composeServiceDef `yaml:"services"`
}

// composeImageDatabase maps well-known compose image names to managed
// database engines so imported stacks get real managed databases.
var composeImageDatabase = map[string]string{
	"postgres": "postgresql", "postgresql": "postgresql",
	"redis": "redis", "dragonfly": "dragonfly", "dragonflydb": "dragonfly",
	"mongo": "mongodb", "mongodb": "mongodb",
	"mysql": "mysql", "mariadb": "mariadb",
	"clickhouse": "clickhouse", "clickhouse-server": "clickhouse",
}

// handleImportCompose converts a docker-compose YAML document into a v2
// template config. It does not persist anything — the response feeds the
// template create form or a direct deploy.
func handleImportCompose(c *gin.Context) {
	if _, ok := requireAuthenticatedUserID(c); !ok {
		return
	}
	var req struct {
		ComposeYAML string `json:"compose_yaml" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.ComposeYAML) > 512*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Compose file exceeds 512 KiB"})
		return
	}

	var file composeFileDef
	if err := yaml.Unmarshal([]byte(req.ComposeYAML), &file); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid compose YAML: " + err.Error()})
		return
	}
	services, warnings, convErr := composeToSpecs(&file)
	if convErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": convErr.Error()})
		return
	}
	variables := []TemplateVariable{}

	config := TemplateConfig{Version: 2, Services: services}
	configJSON, _ := json.Marshal(config)

	c.JSON(http.StatusOK, gin.H{
		"config":    json.RawMessage(configJSON),
		"variables": variables,
		"warnings":  warnings,
	})
}

// composeToSpecs converts a parsed compose file into graph service specs.
// Compose service names become keys; declaration order follows YAML document
// order — yaml.v3 maps lose order, so sort keys for stability.
func composeToSpecs(file *composeFileDef) ([]TemplateServiceSpec, []string, error) {
	if len(file.Services) == 0 {
		return nil, nil, fmt.Errorf("compose file defines no services")
	}
	warnings := []string{}
	services := make([]TemplateServiceSpec, 0, len(file.Services))

	names := make([]string, 0, len(file.Services))
	for name := range file.Services {
		names = append(names, name)
	}
	sort.Strings(names)

	for _, name := range names {
		svc := file.Services[name]
		key := normalizeGraphAlias(name)
		if key == "" {
			warnings = append(warnings, fmt.Sprintf("service %q skipped: name is not usable as a key", name))
			continue
		}
		spec := TemplateServiceSpec{
			Key:       key,
			Name:      name,
			DependsOn: composeDependsOn(svc.DependsOn),
		}

		imageName := strings.TrimSpace(svc.Image)
		engineHint := ""
		if imageName != "" {
			base := imageName
			if idx := strings.IndexAny(base, ":@"); idx > 0 {
				base = base[:idx]
			}
			if slash := strings.LastIndex(base, "/"); slash >= 0 {
				base = base[slash+1:]
			}
			engineHint = composeImageDatabase[strings.ToLower(base)]
		}

		if engineHint != "" && svc.Build == nil {
			spec.Type = "database"
			spec.Runtime = engineHint
			spec.Environment = composeEnvironment(svc.Environment, &warnings, key)
		} else {
			spec.Type = "web"
			spec.Runtime = imageName
			spec.Environment = composeEnvironment(svc.Environment, &warnings, key)
			spec.Port = composeFirstPort(svc.Ports)
			spec.StartCommand = composeCommand(svc.Command)
			if svc.Build != nil && imageName == "" {
				warnings = append(warnings, fmt.Sprintf("%s: build contexts are not supported — publish an image or link a git repo", key))
			}
			if spec.Runtime == "" {
				warnings = append(warnings, fmt.Sprintf("%s: no image defined — set a runtime before deploying", key))
			}
		}

		for _, vol := range svc.Volumes {
			v := composeVolume(vol)
			if v != nil {
				spec.Volumes = append(spec.Volumes, *v)
			}
		}
		services = append(services, spec)
	}

	if len(services) == 0 {
		return nil, warnings, fmt.Errorf("compose file produced no importable services")
	}
	return services, warnings, nil
}

func composeEnvironment(env interface{}, warnings *[]string, svcKey string) map[string]string {
	out := map[string]string{}
	switch e := env.(type) {
	case map[string]interface{}:
		for k, v := range e {
			if v == nil {
				// `KEY:` in a list/map forwards the host value — flag it.
				*warnings = append(*warnings, fmt.Sprintf("%s: env %s has no value — set it at deploy", svcKey, k))
				continue
			}
			out[k] = fmt.Sprintf("%v", v)
		}
	case []interface{}:
		for _, item := range e {
			s, ok := item.(string)
			if !ok {
				continue
			}
			if idx := strings.Index(s, "="); idx > 0 {
				out[s[:idx]] = s[idx+1:]
			} else {
				*warnings = append(*warnings, fmt.Sprintf("%s: env %s has no value — set it at deploy", svcKey, s))
			}
		}
	}
	return out
}

func composeDependsOn(dep interface{}) []string {
	switch d := dep.(type) {
	case []interface{}:
		out := []string{}
		for _, item := range d {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	case map[string]interface{}:
		out := make([]string, 0, len(d))
		for k := range d {
			out = append(out, k)
		}
		return out
	}
	return nil
}

func composeFirstPort(ports []interface{}) int {
	for _, p := range ports {
		switch v := p.(type) {
		case string:
			// "8080:80", "127.0.0.1:8080:80", "80"
			parts := strings.Split(v, ":")
			last := parts[len(parts)-1]
			if slash := strings.Index(last, "/"); slash > 0 {
				last = last[:slash]
			}
			if n, err := strconv.Atoi(last); err == nil && n > 0 {
				return n
			}
		case int:
			return v
		case float64:
			return int(v)
		case map[string]interface{}:
			if t, ok := v["target"]; ok {
				if f, ok := t.(float64); ok {
					return int(f)
				}
				if i, ok := t.(int); ok {
					return i
				}
			}
		}
	}
	return 0
}

func composeCommand(cmd interface{}) string {
	switch v := cmd.(type) {
	case string:
		return v
	case []interface{}:
		parts := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				parts = append(parts, s)
			}
		}
		return strings.Join(parts, " ")
	}
	return ""
}

func composeVolume(vol interface{}) *ServiceVolume {
	s, ok := vol.(string)
	if !ok {
		return nil
	}
	parts := strings.SplitN(s, ":", 3)
	if len(parts) < 2 {
		return nil
	}
	source := strings.TrimSpace(parts[0])
	target := strings.TrimSpace(parts[1])
	if source == "" || target == "" {
		return nil
	}
	v := &ServiceVolume{Source: source, Target: target}
	if strings.HasPrefix(source, "/") || strings.HasPrefix(source, ".") {
		v.Type = "bind"
	} else {
		v.Type = "volume"
	}
	if len(parts) == 3 && strings.Contains(parts[2], "ro") {
		v.ReadOnly = true
	}
	return v
}
