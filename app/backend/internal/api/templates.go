package api

import (
	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/deployment"
	"containr/internal/secrets"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
)

type ServiceTemplate struct {
	ID          string `json:"id" db:"id"`
	Name        string `json:"name" db:"name"`
	Description string `json:"description" db:"description"`
	Category    string `json:"category" db:"category"`
	Logo        string `json:"logo" db:"logo"`
	Config      string `json:"config" db:"config"`
	Variables   string `json:"variables" db:"variables"`
	IsOfficial  bool   `json:"is_official" db:"is_official"`
	OwnerID     string `json:"owner_id,omitempty" db:"owner_id"`
	IsPublic    bool   `json:"is_public" db:"is_public"`
	// Source marks catalog origin: "" (local/official) or "registry".
	Source    string    `json:"source,omitempty" db:"-"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type TemplateConfig struct {
	Version        int               `json:"version,omitempty"`
	Type           string            `json:"type"`
	Runtime        string            `json:"runtime"`
	BuildCommand   string            `json:"build_command"`
	StartCommand   string            `json:"start_command"`
	Port           int               `json:"port"`
	HealthCheck    string            `json:"health_check"`
	Environment    map[string]string `json:"environment"`
	Dockerfile     string            `json:"dockerfile,omitempty"`
	NixpacksConfig map[string]string `json:"nixpacks_config,omitempty"`
	// Services makes this a v2 graph template. When non-empty the flat
	// fields above are ignored and deployTemplateGraph handles the deploy.
	Services []TemplateServiceSpec `json:"services,omitempty"`
}

type TemplateVariable struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Default     string `json:"default"`
	Required    bool   `json:"required"`
	Secret      bool   `json:"secret"`
	Description string `json:"description"`
}

var templateRuntimeImageDefaults = map[string]string{
	"postgres":   "postgres:16-alpine",
	"postgresql": "postgres:16-alpine",
	"redis":      "redis:7-alpine",
	"dragonfly":  "docker.dragonflydb.io/dragonflydb/dragonfly:latest",
	"mongodb":    "mongo:7",
	"mongo":      "mongo:7",
	"mysql":      "mysql:8.4",
	"mariadb":    "mariadb:11",
	"clickhouse": "clickhouse/clickhouse-server:24.8",
}

func handleGetTemplates(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	category := c.Query("category")
	ctx := c.Request.Context()
	queries := sqlcdb.New(db.DB)

	userID := optionalUserUUID(c)
	owner := uuid.NullUUID{UUID: userID, Valid: userID != uuid.Nil}

	var templateRows []sqlcdb.ServiceTemplate
	var err error
	if category != "" {
		templateRows, err = queries.ListServiceTemplatesByCategoryForUser(ctx, sqlcdb.ListServiceTemplatesByCategoryForUserParams{
			Category: category,
			OwnerID:  owner,
		})
	} else {
		templateRows, err = queries.ListServiceTemplatesForUser(ctx, owner)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch templates"})
		return
	}

	templates := make([]ServiceTemplate, 0, len(templateRows))
	localIDs := make(map[string]bool, len(templateRows))
	for _, row := range templateRows {
		localIDs[row.ID] = true
		templates = append(templates, mapSQLCTemplate(row))
	}

	// Merge the configured remote registry (CONTAINR_TEMPLATE_REGISTRY_URL).
	// Registry ids never shadow local templates.
	for _, t := range fetchRegistryTemplates(ctx) {
		if localIDs[t.ID] {
			continue
		}
		if category != "" && t.Category != category {
			continue
		}
		templates = append(templates, t)
	}

	c.JSON(http.StatusOK, gin.H{"templates": templates})
}

func handleGetTemplate(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	templateID := c.Param("id")
	queries := sqlcdb.New(db.DB)

	row, err := queries.GetServiceTemplateByID(c.Request.Context(), templateID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Registry fallback — remote templates materialize read-only.
			if rt := fetchRegistryTemplate(c.Request.Context(), templateID); rt != nil {
				respondRegistryTemplate(c, rt)
				return
			}
			c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch template"})
		return
	}

	t := mapSQLCTemplate(row)
	if t.ID == "" || !templateVisibleTo(c, t) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	var config TemplateConfig
	if err := json.Unmarshal([]byte(t.Config), &config); err == nil {
	}

	var variables []TemplateVariable
	if err := json.Unmarshal([]byte(t.Variables), &variables); err == nil {
	}

	c.JSON(http.StatusOK, gin.H{
		"template":  t,
		"config":    config,
		"variables": variables,
	})
}

func handleCreateFromTemplate(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)
	ctx := c.Request.Context()

	templateID := c.Param("id")

	var req struct {
		ProjectID string            `json:"project_id" binding:"required"`
		Name      string            `json:"name"`
		Plan      string            `json:"plan,omitempty"`
		Region    string            `json:"region,omitempty"`
		Variables map[string]string `json:"variables"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.ProjectID = strings.TrimSpace(req.ProjectID)
	req.Name = strings.TrimSpace(req.Name)

	projectID, err := uuid.Parse(req.ProjectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

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

	templateRow, err := queries.GetServiceTemplateByID(ctx, templateID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Registry template — materialize a local copy for the
			// deployer, then continue down the normal deploy path.
			row, mErr := materializeRegistryTemplate(c, queries, userID, templateID)
			if mErr != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
				return
			}
			templateRow = row
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch template"})
			return
		}
	}

	template := mapSQLCTemplate(templateRow)
	if template.ID == "" || !templateVisibleTo(c, template) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	var config TemplateConfig
	if err := json.Unmarshal([]byte(template.Config), &config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Template configuration is invalid"})
		return
	}

	var templateVars []TemplateVariable
	if err := json.Unmarshal([]byte(template.Variables), &templateVars); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Template variables are invalid"})
		return
	}

	if len(config.Services) > 0 {
		var engine *deployment.DeploymentEngine
		if v, exists := c.Get("deployment_engine"); exists && v != nil {
			engine, _ = v.(*deployment.DeploymentEngine)
		}
		var dbHandler *DatabaseHandler
		if v, exists := c.Get("database_handler"); exists {
			dbHandler, _ = v.(*DatabaseHandler)
		}

		userVars := map[string]string{}
		for _, v := range templateVars {
			if override, ok := req.Variables[v.Key]; ok {
				userVars[v.Key] = override
			} else if v.Default != "" {
				userVars[v.Key] = v.Default
			}
		}
		for k, v := range req.Variables {
			userVars[k] = v
		}

		created, fail := deployTemplateGraph(c, db, engine, dbHandler, projectID, userID,
			config.Services, templateVars, userVars, req.Plan, req.Region, "template:"+templateID)
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
			"message":  fmt.Sprintf("Deployed %d resources from template %s", len(created), template.Name),
		})
		return
	}

	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	serviceType, err := normalizeTemplateServiceType(config.Type)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	envVars, secretKeys, missingRequired := mergeTemplateVariables(config.Environment, templateVars, req.Variables)
	if len(missingRequired) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":             fmt.Sprintf("Missing required template variables: %s", strings.Join(missingRequired, ", ")),
			"missing_variables": missingRequired,
		})
		return
	}

	if serviceType == "database" {
		handler, ok := c.Get("database_handler")
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database handler unavailable"})
			return
		}

		dbHandler, ok := handler.(*DatabaseHandler)
		if !ok || dbHandler == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database handler unavailable"})
			return
		}

		databaseID, err := dbHandler.createManagedDatabaseAndProvision(ctx, userID, managedDatabaseCreateRequest{
			Name:             req.Name,
			Type:             config.Runtime,
			Plan:             req.Plan,
			Region:           req.Region,
			RuntimeVariables: envVars,
		})
		if err != nil {
			switch {
			case errors.Is(err, errDatabaseNameRequired), errors.Is(err, errUnsupportedDatabaseType), errors.Is(err, errUnsupportedDatabasePlan):
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			case errors.Is(err, errDatabaseNameAlreadyInUse):
				c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create managed database from template"})
			}
			return
		}

		LogAudit(userID, "database", databaseID, "create", map[string]interface{}{
			"template_id": templateID,
			"name":        req.Name,
			"type":        normalizeDatabaseType(config.Runtime),
			"project_id":  req.ProjectID,
		})

		c.JSON(http.StatusCreated, gin.H{
			"database_id": databaseID,
			"resource":    "database",
			"message":     "Managed database provisioning started from template",
		})
		return
	}

	serviceCount, err := queries.CountServicesByProjectAndName(ctx, sqlcdb.CountServicesByProjectAndNameParams{
		ProjectID: projectID,
		Name:      req.Name,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate service name"})
		return
	}
	if serviceCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Service name already exists in this project"})
		return
	}

	serviceImage := resolveTemplateRuntimeImage(config.Runtime)
	serviceCommand := strings.TrimSpace(config.StartCommand)
	buildCommand := strings.TrimSpace(config.BuildCommand)
	cpu, memory := defaultTemplateResources(serviceType)
	serviceEnvironment := "production"

	environmentID, err := getProjectEnvironmentID(db, projectID, serviceEnvironment)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve service environment"})
		return
	}

	serviceID := uuid.New()
	now := time.Now()

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize template deployment"})
		return
	}
	defer tx.Rollback()

	txQueries := queries.WithTx(tx)
	err = txQueries.CreateServiceFromTemplate(ctx, sqlcdb.CreateServiceFromTemplateParams{
		ID:            serviceID,
		ProjectID:     projectID,
		Name:          req.Name,
		EnvironmentID: environmentID,
		ServiceType:   serviceType,
		SourceType:    "template",
		ImageName:     sql.NullString{String: serviceImage, Valid: serviceImage != ""},
		BuildCommand:  sql.NullString{String: buildCommand, Valid: buildCommand != ""},
		StartCommand:  sql.NullString{String: serviceCommand, Valid: serviceCommand != ""},
		Type:          sql.NullString{String: serviceType, Valid: true},
		Status:        sql.NullString{String: "stopped", Valid: true},
		Image:         sql.NullString{String: serviceImage, Valid: serviceImage != ""},
		Command:       sql.NullString{String: serviceCommand, Valid: serviceCommand != ""},
		Environment:   sql.NullString{String: serviceEnvironment, Valid: true},
		Cpu:           sql.NullString{String: cpu, Valid: true},
		Memory:        sql.NullString{String: memory, Valid: true},
		CreatedAt:     sql.NullTime{Time: now, Valid: true},
		UpdatedAt:     sql.NullTime{Time: now, Valid: true},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create service from template"})
		return
	}

	// sqlc's schema predates the runtime columns; port and healthcheck_path are
	// written via raw SQL like every other service mutation path.
	if _, err = tx.ExecContext(ctx,
		`UPDATE services SET port = $1, healthcheck_path = $2 WHERE id = $3`,
		config.Port, strings.TrimSpace(config.HealthCheck), serviceID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create service from template"})
		return
	}

	for key, value := range envVars {
		if strings.TrimSpace(key) == "" {
			continue
		}

		stored := value
		if secretKeys[key] {
			stored = secrets.Encrypt(value)
		}
		err = txQueries.UpsertEnvironmentVariable(ctx, sqlcdb.UpsertEnvironmentVariableParams{
			ID:        uuid.New(),
			ServiceID: serviceID,
			Key:       key,
			Value:     stored,
			IsSecret:  sql.NullBool{Bool: secretKeys[key], Valid: true},
			CreatedAt: sql.NullTime{Time: now, Valid: true},
			UpdatedAt: sql.NullTime{Time: now, Valid: true},
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save template variables"})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to finalize service from template"})
		return
	}

	LogAudit(userID, "service", serviceID.String(), "create", map[string]interface{}{
		"template_id": templateID,
		"name":        req.Name,
		"type":        serviceType,
	})

	c.JSON(http.StatusCreated, gin.H{
		"service_id": serviceID.String(),
		"resource":   "service",
		"message":    "Service created from template",
	})
}

// templateWriteRequest is the admin payload for creating/updating a user
// template. config must decode into TemplateConfig; variables into
// []TemplateVariable.
type templateWriteRequest struct {
	Name        string          `json:"name" binding:"required"`
	Description string          `json:"description"`
	Category    string          `json:"category"`
	Logo        string          `json:"logo"`
	Config      json.RawMessage `json:"config" binding:"required"`
	Variables   json.RawMessage `json:"variables"`
	IsPublic    bool            `json:"is_public"`
}

var templateCategories = map[string]bool{
	"web": true, "frontend": true, "api": true, "database": true,
	"worker": true, "cron": true, "app": true, "custom": true,
}

func normalizeTemplateCategory(category string) string {
	normalized := strings.ToLower(strings.TrimSpace(category))
	if templateCategories[normalized] {
		return normalized
	}
	return "custom"
}

func validateTemplateWrite(c *gin.Context, req *templateWriteRequest) bool {
	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 2 || len(req.Name) > 120 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name must be 2-120 characters"})
		return false
	}
	req.Category = normalizeTemplateCategory(req.Category)
	req.Logo = strings.TrimSpace(req.Logo)
	if len(req.Logo) > 500 || (req.Logo != "" && !strings.HasPrefix(req.Logo, "https://") && !strings.HasPrefix(req.Logo, "http://")) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "logo must be an http(s) URL up to 500 chars"})
		return false
	}
	if len(req.Config) == 0 || len(req.Config) > 64*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "config is required and must be under 64KB"})
		return false
	}
	var config TemplateConfig
	if err := json.Unmarshal(req.Config, &config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "config must be a valid template config object"})
		return false
	}
	if _, err := normalizeTemplateServiceType(config.Type); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return false
	}
	if len(req.Variables) > 0 {
		if len(req.Variables) > 64*1024 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "variables must be under 64KB"})
			return false
		}
		var variables []TemplateVariable
		if err := json.Unmarshal(req.Variables, &variables); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "variables must be an array"})
			return false
		}
		for _, v := range variables {
			if strings.TrimSpace(v.Key) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "every variable needs a key"})
				return false
			}
		}
	}
	return true
}

func templateVariablesParam(raw json.RawMessage) pqtype.NullRawMessage {
	if len(raw) == 0 {
		return pqtype.NullRawMessage{}
	}
	return pqtype.NullRawMessage{RawMessage: raw, Valid: true}
}

func handleCreateTemplate(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)

	var req templateWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !validateTemplateWrite(c, &req) {
		return
	}

	ownerUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context"})
		return
	}

	id := "usr-" + uuid.NewString()
	if err := queries.CreateUserTemplate(c.Request.Context(), sqlcdb.CreateUserTemplateParams{
		ID:          id,
		Name:        req.Name,
		Description: nullableText(strings.TrimSpace(req.Description)),
		Category:    req.Category,
		Logo:        nullableText(req.Logo),
		Config:      req.Config,
		Variables:   templateVariablesParam(req.Variables),
		OwnerID:     uuid.NullUUID{UUID: ownerUUID, Valid: true},
		IsPublic:    req.IsPublic,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create template"})
		return
	}

	LogAudit(userID, "template", id, "create", map[string]interface{}{"name": req.Name})

	row, err := queries.GetServiceTemplateByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusCreated, gin.H{"template": gin.H{"id": id, "name": req.Name}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"template": mapSQLCTemplate(row)})
}

func handleUpdateTemplate(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)
	templateID := c.Param("id")

	var req templateWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !validateTemplateWrite(c, &req) {
		return
	}

	ownerUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context"})
		return
	}

	rows, err := queries.UpdateUserTemplate(c.Request.Context(), sqlcdb.UpdateUserTemplateParams{
		Name:        req.Name,
		Description: nullableText(strings.TrimSpace(req.Description)),
		Category:    req.Category,
		Logo:        nullableText(req.Logo),
		Config:      req.Config,
		Variables:   templateVariablesParam(req.Variables),
		IsPublic:    req.IsPublic,
		ID:          templateID,
		OwnerID:     uuid.NullUUID{UUID: ownerUUID, Valid: true},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update template"})
		return
	}
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found or not editable"})
		return
	}

	LogAudit(userID, "template", templateID, "update", map[string]interface{}{"name": req.Name})

	row, err := queries.GetServiceTemplateByID(c.Request.Context(), templateID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "Template updated"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"template": mapSQLCTemplate(row)})
}

func handleDeleteTemplate(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	queries := sqlcdb.New(db.DB)
	templateID := c.Param("id")

	ownerUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context"})
		return
	}

	rows, err := queries.DeleteUserTemplate(c.Request.Context(), sqlcdb.DeleteUserTemplateParams{
		ID:      templateID,
		OwnerID: uuid.NullUUID{UUID: ownerUUID, Valid: true},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete template"})
		return
	}
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found or not deletable"})
		return
	}

	LogAudit(userID, "template", templateID, "delete", nil)
	c.JSON(http.StatusOK, gin.H{"message": "Template deleted"})
}

// SeedOfficialTemplates upserts the built-in catalog on startup so new
// templates ship with releases without needing a migration per entry.
func SeedOfficialTemplates(ctx context.Context, db *database.DB) {
	if db == nil || db.DB == nil {
		return
	}
	queries := sqlcdb.New(db.DB)
	for _, t := range SeedTemplates() {
		variables := pqtype.NullRawMessage{}
		if strings.TrimSpace(t.Variables) != "" {
			variables = pqtype.NullRawMessage{RawMessage: json.RawMessage(t.Variables), Valid: true}
		}
		if err := queries.UpsertServiceTemplate(ctx, sqlcdb.UpsertServiceTemplateParams{
			ID:          t.ID,
			Name:        t.Name,
			Description: nullableText(t.Description),
			Category:    t.Category,
			Logo:        nullableText(t.Logo),
			Config:      json.RawMessage(t.Config),
			Variables:   variables,
			IsOfficial:  sql.NullBool{Bool: true, Valid: true},
		}); err != nil {
			log.Printf("Failed to seed template %s: %v", t.ID, err)
		}
	}
}

func SeedTemplates() []ServiceTemplate {
	templates := []ServiceTemplate{
		{
			ID:          "tpl-nodejs",
			Name:        "Node.js Application",
			Description: "Generic Node.js application with automatic dependency detection",
			Category:    "web",
			Logo:        "https://cdn.simpleicons.org/node.js",
			Config:      `{"type":"web","runtime":"node","build_command":"npm install && npm run build","start_command":"npm start","port":3000,"health_check":"/health"}`,
			Variables:   `[{"key":"NODE_ENV","label":"Node Environment","default":"production","required":false,"secret":false},{"key":"NPM_TOKEN","label":"NPM Token","default":"","required":false,"secret":true}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-react",
			Name:        "React Application",
			Description: "React single-page application with Vite",
			Category:    "frontend",
			Logo:        "https://cdn.simpleicons.org/react",
			Config:      `{"type":"web","runtime":"node","build_command":"npm install && npm run build","start_command":"npx serve -s dist","port":3000}`,
			Variables:   `[{"key":"VITE_API_URL","label":"API URL","default":"","required":true,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-python",
			Name:        "Python Application",
			Description: "Python application with FastAPI/Flask support",
			Category:    "web",
			Logo:        "https://cdn.simpleicons.org/python",
			Config:      `{"type":"web","runtime":"python","build_command":"pip install -r requirements.txt","start_command":"python main.py","port":8000}`,
			Variables:   `[{"key":"PYTHON_VERSION","label":"Python Version","default":"3.11","required":false,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-go",
			Name:        "Go Application",
			Description: "Go backend service",
			Category:    "web",
			Logo:        "https://cdn.simpleicons.org/go",
			Config:      `{"type":"web","runtime":"go","build_command":"go build -o app .","start_command":"./app","port":8080}`,
			Variables:   `[{"key":"GO_VERSION","label":"Go Version","default":"1.21","required":false,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-postgres",
			Name:        "PostgreSQL Database",
			Description: "Managed PostgreSQL database",
			Category:    "database",
			Logo:        "https://cdn.simpleicons.org/postgresql",
			Config:      `{"type":"database","runtime":"postgres","port":5432}`,
			Variables:   `[{"key":"POSTGRES_USER","label":"Username","default":"postgres","required":true,"secret":false},{"key":"POSTGRES_PASSWORD","label":"Password","default":"","required":true,"secret":true},{"key":"POSTGRES_DB","label":"Database Name","default":"app","required":true,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-redis",
			Name:        "Redis Cache",
			Description: "In-memory data store",
			Category:    "database",
			Logo:        "https://cdn.simpleicons.org/redis",
			Config:      `{"type":"database","runtime":"redis","port":6379}`,
			Variables:   `[{"key":"REDIS_PASSWORD","label":"Password","default":"","required":false,"secret":true}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-mongodb",
			Name:        "MongoDB Database",
			Description: "NoSQL document database",
			Category:    "database",
			Logo:        "https://cdn.simpleicons.org/mongodb",
			Config:      `{"type":"database","runtime":"mongodb","port":27017}`,
			Variables:   `[{"key":"MONGO_INITDB_ROOT_USERNAME","label":"Root Username","default":"admin","required":true,"secret":false},{"key":"MONGO_INITDB_ROOT_PASSWORD","label":"Root Password","default":"","required":true,"secret":true}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-mysql",
			Name:        "MySQL Database",
			Description: "Managed MySQL database service",
			Category:    "database",
			Logo:        "https://cdn.simpleicons.org/mysql",
			Config:      `{"type":"database","runtime":"mysql","port":3306}`,
			Variables:   `[{"key":"MYSQL_DATABASE","label":"Database Name","default":"app","required":true,"secret":false},{"key":"MYSQL_USER","label":"Username","default":"app","required":true,"secret":false},{"key":"MYSQL_PASSWORD","label":"User Password","default":"","required":true,"secret":true},{"key":"MYSQL_ROOT_PASSWORD","label":"Root Password","default":"","required":true,"secret":true}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-mariadb",
			Name:        "MariaDB Database",
			Description: "Managed MariaDB database service",
			Category:    "database",
			Logo:        "https://cdn.simpleicons.org/mariadb",
			Config:      `{"type":"database","runtime":"mariadb","port":3306}`,
			Variables:   `[{"key":"MARIADB_DATABASE","label":"Database Name","default":"app","required":true,"secret":false},{"key":"MARIADB_USER","label":"Username","default":"app","required":true,"secret":false},{"key":"MARIADB_PASSWORD","label":"User Password","default":"","required":true,"secret":true},{"key":"MARIADB_ROOT_PASSWORD","label":"Root Password","default":"","required":true,"secret":true}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-clickhouse",
			Name:        "ClickHouse Database",
			Description: "Column-oriented analytics database",
			Category:    "database",
			Logo:        "https://cdn.simpleicons.org/clickhouse",
			Config:      `{"type":"database","runtime":"clickhouse","port":8123}`,
			Variables:   `[{"key":"CLICKHOUSE_DB","label":"Database Name","default":"app","required":false,"secret":false},{"key":"CLICKHOUSE_USER","label":"Username","default":"default","required":false,"secret":false},{"key":"CLICKHOUSE_PASSWORD","label":"Password","default":"","required":false,"secret":true}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-dragonfly",
			Name:        "Dragonfly Database",
			Description: "Redis-compatible in-memory data store powered by Dragonfly",
			Category:    "database",
			Logo:        "https://cdn.simpleicons.org/redis",
			Config:      `{"type":"database","runtime":"dragonfly","port":6379}`,
			Variables:   `[{"key":"DRAGONFLY_PASSWORD","label":"Password","default":"","required":false,"secret":true}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-worker",
			Name:        "Background Worker",
			Description: "Background job processing service",
			Category:    "worker",
			Logo:        "https://cdn.simpleicons.org/gnubash",
			Config:      `{"type":"worker","runtime":"node","build_command":"npm install","start_command":"npm run worker"}`,
			Variables:   `[{"key":"WORKER_CONCURRENCY","label":"Concurrency","default":"4","required":false,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-cron",
			Name:        "Cron Job",
			Description: "Scheduled task runner",
			Category:    "cron",
			Logo:        "https://cdn.simpleicons.org/clockify",
			Config:      `{"type":"cron","runtime":"node","build_command":"npm install","start_command":"npm run cron"}`,
			Variables:   `[{"key":"CRON_SCHEDULE","label":"Schedule","default":"0 * * * *","required":true,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-docker",
			Name:        "Docker Image",
			Description: "Deploy from any Docker image",
			Category:    "custom",
			Logo:        "https://cdn.simpleicons.org/docker",
			Config:      `{"type":"web","runtime":"docker","port":80}`,
			Variables:   `[{"key":"IMAGE","label":"Docker Image","default":"","required":true,"secret":false},{"key":"TAG","label":"Image Tag","default":"latest","required":false,"secret":false}]`,
			IsOfficial:  true,
		},
		// Self-hosted applications — runtime doubles as the image reference.
		{
			ID:          "tpl-nextcloud",
			Name:        "Nextcloud",
			Description: "Self-hosted file sync, share and collaboration platform",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/nextcloud",
			Config:      `{"type":"web","runtime":"nextcloud:30-apache","port":80,"health_check":"/status.php"}`,
			Variables:   `[{"key":"NEXTCLOUD_ADMIN_USER","label":"Admin User","default":"admin","required":false,"secret":false},{"key":"NEXTCLOUD_ADMIN_PASSWORD","label":"Admin Password","default":"","required":true,"secret":true},{"key":"NEXTCLOUD_TRUSTED_DOMAINS","label":"Trusted Domains","default":"","required":false,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-gitea",
			Name:        "Gitea",
			Description: "Lightweight self-hosted Git service",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/gitea",
			Config:      `{"type":"web","runtime":"gitea/gitea:1","port":3000,"health_check":"/api/healthz"}`,
			Variables:   `[{"key":"GITEA__server__DOMAIN","label":"Server Domain","default":"localhost","required":false,"secret":false},{"key":"GITEA__server__ROOT_URL","label":"Root URL","default":"","required":false,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-ghost",
			Name:        "Ghost",
			Description: "Independent publishing platform for blogs and newsletters",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/ghost",
			Config:      `{"type":"web","runtime":"ghost:5-alpine","port":2368,"health_check":"/ghost/api/admin/site/"}`,
			Variables:   `[{"key":"url","label":"Public URL","default":"","required":true,"secret":false},{"key":"database__client","label":"Database Client","default":"sqlite3","required":false,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-uptime-kuma",
			Name:        "Uptime Kuma",
			Description: "Self-hosted monitoring tool for services and websites",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/uptimerobot",
			Config:      `{"type":"web","runtime":"louislam/uptime-kuma:1","port":3001,"health_check":"/"}`,
			Variables:   `[]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-vaultwarden",
			Name:        "Vaultwarden",
			Description: "Lightweight Bitwarden-compatible password manager",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/bitwarden",
			Config:      `{"type":"web","runtime":"vaultwarden/server:latest","port":80,"health_check":"/alive"}`,
			Variables:   `[{"key":"ADMIN_TOKEN","label":"Admin Token","default":"","required":false,"secret":true},{"key":"SIGNUPS_ALLOWED","label":"Allow Signups","default":"false","required":false,"secret":false},{"key":"DOMAIN","label":"Domain URL","default":"","required":false,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-jellyfin",
			Name:        "Jellyfin",
			Description: "Free software media system for movies, shows and music",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/jellyfin",
			Config:      `{"type":"web","runtime":"jellyfin/jellyfin:latest","port":8096,"health_check":"/health"}`,
			Variables:   `[]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-n8n",
			Name:        "n8n",
			Description: "Workflow automation tool with hundreds of integrations",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/n8n",
			Config:      `{"type":"web","runtime":"n8nio/n8n:latest","port":5678,"health_check":"/healthz"}`,
			Variables:   `[{"key":"N8N_HOST","label":"Hostname","default":"","required":false,"secret":false},{"key":"N8N_ENCRYPTION_KEY","label":"Encryption Key","default":"","required":true,"secret":true},{"key":"WEBHOOK_URL","label":"Webhook URL","default":"","required":false,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-grafana",
			Name:        "Grafana",
			Description: "Observability dashboards for metrics, logs and traces",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/grafana",
			Config:      `{"type":"web","runtime":"grafana/grafana:latest","port":3000,"health_check":"/api/health"}`,
			Variables:   `[{"key":"GF_SECURITY_ADMIN_PASSWORD","label":"Admin Password","default":"","required":true,"secret":true}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-immich",
			Name:        "Immich",
			Description: "Self-hosted photo and video backup",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/immich",
			Config:      `{"type":"web","runtime":"ghcr.io/immich-app/immich-server:release","port":2283,"health_check":"/api/server/ping"}`,
			Variables:   `[{"key":"DB_PASSWORD","label":"Database Password","default":"","required":true,"secret":true},{"key":"DB_HOSTNAME","label":"Database Host","default":"","required":false,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-meilisearch",
			Name:        "Meilisearch",
			Description: "Fast, typo-tolerant search engine API",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/meilisearch",
			Config:      `{"type":"web","runtime":"getmeili/meilisearch:v1","port":7700,"health_check":"/health"}`,
			Variables:   `[{"key":"MEILI_MASTER_KEY","label":"Master Key","default":"","required":true,"secret":true},{"key":"MEILI_ENV","label":"Environment","default":"production","required":false,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-plausible",
			Name:        "Plausible Analytics",
			Description: "Lightweight, privacy-friendly web analytics",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/plausibleanalytics",
			Config:      `{"type":"web","runtime":"ghcr.io/plausible/community-edition:v2","port":8000,"health_check":"/api/health"}`,
			Variables:   `[{"key":"BASE_URL","label":"Base URL","default":"","required":true,"secret":false},{"key":"SECRET_KEY_BASE","label":"Secret Key Base","default":"","required":true,"secret":true}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-minio",
			Name:        "MinIO",
			Description: "S3-compatible object storage",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/minio",
			Config:      `{"type":"web","runtime":"minio/minio:latest","start_command":"server /data --console-address \":9001\"","port":9001,"health_check":"/minio/health/live"}`,
			Variables:   `[{"key":"MINIO_ROOT_USER","label":"Root User","default":"minioadmin","required":true,"secret":false},{"key":"MINIO_ROOT_PASSWORD","label":"Root Password","default":"","required":true,"secret":true}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-appwrite",
			Name:        "Appwrite",
			Description: "Backend-as-a-service for web and mobile apps",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/appwrite",
			Config:      `{"type":"web","runtime":"appwrite/appwrite:1.6","port":80,"health_check":"/health"}`,
			Variables:   `[]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-wordpress",
			Name:        "WordPress",
			Description: "Classic CMS powering a large share of the web",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/wordpress",
			Config:      `{"type":"web","runtime":"wordpress:6-apache","port":80,"health_check":"/wp-login.php"}`,
			Variables:   `[{"key":"WORDPRESS_DB_HOST","label":"Database Host","default":"","required":true,"secret":false},{"key":"WORDPRESS_DB_USER","label":"Database User","default":"wordpress","required":true,"secret":false},{"key":"WORDPRESS_DB_PASSWORD","label":"Database Password","default":"","required":true,"secret":true},{"key":"WORDPRESS_DB_NAME","label":"Database Name","default":"wordpress","required":true,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-paperless",
			Name:        "Paperless-ngx",
			Description: "Document management system with OCR",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/paperlessngx",
			Config:      `{"type":"web","runtime":"ghcr.io/paperless-ngx/paperless-ngx:latest","port":8000,"health_check":"/api/"}`,
			Variables:   `[{"key":"PAPERLESS_ADMIN_PASSWORD","label":"Admin Password","default":"","required":true,"secret":true},{"key":"PAPERLESS_URL","label":"Public URL","default":"","required":false,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-ntfy",
			Name:        "ntfy",
			Description: "Push notification service over HTTP",
			Category:    "app",
			Logo:        "https://cdn.simpleicons.org/ntfy",
			Config:      `{"type":"web","runtime":"binwiederhier/ntfy:latest","start_command":"serve","port":80,"health_check":"/v1/health"}`,
			Variables:   `[]`,
			IsOfficial:  true,
		},
		// Multi-service stacks — v2 graph configs. Database members become
		// managed databases attached to the project network under their key.
		{
			ID:          "tpl-wordpress-stack",
			Name:        "WordPress + MySQL",
			Description: "WordPress with a managed MySQL database on a private project network",
			Category:    "stack",
			Logo:        "https://cdn.simpleicons.org/wordpress",
			Config: `{"version":2,"services":[
				{"key":"db","type":"database","runtime":"mysql","environment":{"MYSQL_DATABASE":"wordpress"}},
				{"key":"web","name":"wordpress","type":"web","runtime":"wordpress:6-apache","port":80,"health_check":"/wp-login.php","depends_on":["db"],
				 "environment":{"WORDPRESS_DB_HOST":"{{service.db.host}}","WORDPRESS_DB_USER":"{{service.db.user}}","WORDPRESS_DB_PASSWORD":"{{service.db.password}}","WORDPRESS_DB_NAME":"{{service.db.database}}"}}]}`,
			Variables:  `[]`,
			IsOfficial: true,
		},
		{
			ID:          "tpl-n8n-stack",
			Name:        "n8n + PostgreSQL",
			Description: "n8n workflow automation backed by a managed PostgreSQL database",
			Category:    "stack",
			Logo:        "https://cdn.simpleicons.org/n8n",
			Config: `{"version":2,"services":[
				{"key":"db","type":"database","runtime":"postgresql"},
				{"key":"n8n","type":"web","runtime":"n8nio/n8n:latest","port":5678,"health_check":"/healthz","depends_on":["db"],
				 "environment":{"DB_TYPE":"postgresdb","DB_POSTGRESDB_HOST":"{{service.db.host}}","DB_POSTGRESDB_PORT":"{{service.db.port}}","DB_POSTGRESDB_DATABASE":"{{service.db.database}}","DB_POSTGRESDB_USER":"{{service.db.user}}","DB_POSTGRESDB_PASSWORD":"{{service.db.password}}","N8N_ENCRYPTION_KEY":"{{secret}}"}}]}`,
			Variables:  `[]`,
			IsOfficial: true,
		},
		{
			ID:          "tpl-ghost-stack",
			Name:        "Ghost + MySQL",
			Description: "Ghost publishing platform backed by a managed MySQL database",
			Category:    "stack",
			Logo:        "https://cdn.simpleicons.org/ghost",
			Config: `{"version":2,"services":[
				{"key":"db","type":"database","runtime":"mysql","environment":{"MYSQL_DATABASE":"ghost"}},
				{"key":"web","name":"ghost","type":"web","runtime":"ghost:5-alpine","port":2368,"depends_on":["db"],
				 "environment":{"url":"{{APP_URL:-http://localhost:2368}}","database__client":"mysql","database__connection__host":"{{service.db.host}}","database__connection__user":"{{service.db.user}}","database__connection__password":"{{service.db.password}}","database__connection__database":"{{service.db.database}}"}}]}`,
			Variables:  `[{"key":"APP_URL","label":"Public URL","default":"","required":false,"secret":false}]`,
			IsOfficial: true,
		},
		{
			ID:          "tpl-gitea-stack",
			Name:        "Gitea + PostgreSQL",
			Description: "Self-hosted Git service backed by a managed PostgreSQL database",
			Category:    "stack",
			Logo:        "https://cdn.simpleicons.org/gitea",
			Config: `{"version":2,"services":[
				{"key":"db","type":"database","runtime":"postgresql","environment":{"POSTGRES_DB":"gitea"}},
				{"key":"web","name":"gitea","type":"web","runtime":"gitea/gitea:1","port":3000,"health_check":"/api/healthz","depends_on":["db"],
				 "environment":{"GITEA__database__DB_TYPE":"postgres","GITEA__database__HOST":"{{service.db.host}}:{{service.db.port}}","GITEA__database__NAME":"{{service.db.database}}","GITEA__database__USER":"{{service.db.user}}","GITEA__database__PASSWD":"{{service.db.password}}","GITEA__security__SECRET_KEY":"{{secret}}","GITEA__security__INTERNAL_TOKEN":"{{secret(64)}}"}}]}`,
			Variables:  `[]`,
			IsOfficial: true,
		},
		{
			ID:          "tpl-nextcloud-stack",
			Name:        "Nextcloud + PostgreSQL + Redis",
			Description: "Nextcloud with a managed PostgreSQL database and Redis cache",
			Category:    "stack",
			Logo:        "https://cdn.simpleicons.org/nextcloud",
			Config: `{"version":2,"services":[
				{"key":"db","type":"database","runtime":"postgresql","environment":{"POSTGRES_DB":"nextcloud"}},
				{"key":"cache","type":"database","runtime":"redis"},
				{"key":"web","name":"nextcloud","type":"web","runtime":"nextcloud:30-apache","port":80,"health_check":"/status.php","depends_on":["db","cache"],
				 "environment":{"POSTGRES_HOST":"{{service.db.host}}","POSTGRES_DB":"{{service.db.database}}","POSTGRES_USER":"{{service.db.user}}","POSTGRES_PASSWORD":"{{service.db.password}}","REDIS_HOST":"{{service.cache.host}}","REDIS_HOST_PASSWORD":"{{service.cache.password}}","NEXTCLOUD_ADMIN_USER":"admin","NEXTCLOUD_ADMIN_PASSWORD":"{{secret}}","NEXTCLOUD_TRUSTED_DOMAINS":"{{APP_DOMAIN:-localhost}}"}}]}`,
			Variables:  `[{"key":"APP_DOMAIN","label":"Trusted domain","default":"","required":false,"secret":false}]`,
			IsOfficial: true,
		},
		{
			ID:          "tpl-paperless-stack",
			Name:        "Paperless-ngx + PostgreSQL + Redis",
			Description: "Document management with managed PostgreSQL and Redis",
			Category:    "stack",
			Logo:        "https://cdn.simpleicons.org/paperlessngx",
			Config: `{"version":2,"services":[
				{"key":"db","type":"database","runtime":"postgresql","environment":{"POSTGRES_DB":"paperless"}},
				{"key":"cache","type":"database","runtime":"redis"},
				{"key":"web","name":"paperless","type":"web","runtime":"ghcr.io/paperless-ngx/paperless-ngx:latest","port":8000,"depends_on":["db","cache"],
				 "environment":{"PAPERLESS_DBHOST":"{{service.db.host}}","PAPERLESS_DBPORT":"{{service.db.port}}","PAPERLESS_DBNAME":"{{service.db.database}}","PAPERLESS_DBUSER":"{{service.db.user}}","PAPERLESS_DBPASS":"{{service.db.password}}","PAPERLESS_REDIS":"{{service.cache.url}}","PAPERLESS_ADMIN_USER":"admin","PAPERLESS_ADMIN_PASSWORD":"{{secret}}","PAPERLESS_SECRET_KEY":"{{secret(48)}}","PAPERLESS_URL":"{{APP_URL:-http://localhost:8000}}"}}]}`,
			Variables:  `[{"key":"APP_URL","label":"Public URL","default":"","required":false,"secret":false}]`,
			IsOfficial: true,
		},
		{
			ID:          "tpl-plausible-stack",
			Name:        "Plausible + PostgreSQL + ClickHouse",
			Description: "Privacy-friendly analytics with managed PostgreSQL and ClickHouse",
			Category:    "stack",
			Logo:        "https://cdn.simpleicons.org/plausibleanalytics",
			Config: `{"version":2,"services":[
				{"key":"db","type":"database","runtime":"postgresql","environment":{"POSTGRES_DB":"plausible"}},
				{"key":"events","type":"database","runtime":"clickhouse","environment":{"CLICKHOUSE_DB":"plausible"}},
				{"key":"web","name":"plausible","type":"web","runtime":"ghcr.io/plausible/community-edition:v2","port":8000,"health_check":"/api/health","depends_on":["db","events"],
				 "environment":{"BASE_URL":"{{APP_URL:-http://localhost:8000}}","SECRET_KEY_BASE":"{{secret(64)}}","DATABASE_URL":"{{service.db.url}}","CLICKHOUSE_DATABASE_URL":"http://{{service.events.host}}:{{service.events.port}}/{{service.events.database}}","TOTP_VAULT_KEY":"{{secret(32)}}"}}]}`,
			Variables:  `[{"key":"APP_URL","label":"Public URL","default":"","required":false,"secret":false}]`,
			IsOfficial: true,
		},
		{
			ID:          "tpl-n8n",
			Name:        "n8n + PostgreSQL + Redis",
			Description: "Workflow automation in queue mode with managed PostgreSQL and Redis",
			Category:    "stack",
			Logo:        "https://cdn.simpleicons.org/n8n",
			Config: `{"version":2,"services":[
				{"key":"db","type":"database","runtime":"postgresql","environment":{"POSTGRES_DB":"n8n","POSTGRES_USER":"n8n"},"volumes":[{"source":"n8n-db","target":"/var/lib/postgresql/data"}]},
				{"key":"redis","type":"database","runtime":"redis"},
				{"key":"n8n","type":"web","runtime":"docker.n8n.io/n8nio/n8n:latest","port":5678,"health_check":"/healthz","depends_on":["db","redis"],
				 "environment":{"DB_TYPE":"postgresdb","DB_POSTGRESDB_HOST":"{{service.db.host}}","DB_POSTGRESDB_PORT":"5432","DB_POSTGRESDB_DATABASE":"{{service.db.database}}","DB_POSTGRESDB_USER":"{{service.db.user}}","DB_POSTGRESDB_PASSWORD":"{{service.db.password}}","QUEUE_BULL_REDIS_HOST":"{{service.redis.host}}","QUEUE_BULL_REDIS_PASSWORD":"{{service.redis.password}}","EXECUTIONS_MODE":"queue","N8N_ENCRYPTION_KEY":"{{secret(32)}}","N8N_HOST":"{{APP_URL:-http://localhost:5678}}","N8N_EDITOR_BASE_URL":"{{APP_URL:-http://localhost:5678}}"},
				 "volumes":[{"source":"n8n-data","target":"/home/node/.n8n"}]},
				{"key":"worker","name":"n8n-worker","type":"worker","runtime":"docker.n8n.io/n8nio/n8n:latest","start_command":"worker","depends_on":["n8n","db","redis"],
				 "environment":{"DB_TYPE":"postgresdb","DB_POSTGRESDB_HOST":"{{service.db.host}}","DB_POSTGRESDB_PORT":"5432","DB_POSTGRESDB_DATABASE":"{{service.db.database}}","DB_POSTGRESDB_USER":"{{service.db.user}}","DB_POSTGRESDB_PASSWORD":"{{service.db.password}}","QUEUE_BULL_REDIS_HOST":"{{service.redis.host}}","QUEUE_BULL_REDIS_PASSWORD":"{{service.redis.password}}","EXECUTIONS_MODE":"queue","N8N_ENCRYPTION_KEY":"{{secret(32)}}","QUEUE_HEALTH_CHECK_ACTIVE":"true"},
				 "volumes":[{"source":"n8n-data","target":"/home/node/.n8n"}]}]}`,
			Variables:  `[{"key":"APP_URL","label":"Public URL","default":"","required":false,"secret":false}]`,
			IsOfficial: true,
		},
		{
			ID:          "tpl-gitea",
			Name:        "Gitea + PostgreSQL",
			Description: "Self-hosted git service with managed PostgreSQL",
			Category:    "stack",
			Logo:        "https://cdn.simpleicons.org/gitea",
			Config: `{"version":2,"services":[
				{"key":"db","type":"database","runtime":"postgresql","environment":{"POSTGRES_DB":"gitea","POSTGRES_USER":"gitea"},"volumes":[{"source":"gitea-db","target":"/var/lib/postgresql/data"}]},
				{"key":"gitea","type":"web","runtime":"gitea/gitea:latest","port":3000,"health_check":"/api/healthz","depends_on":["db"],
				 "environment":{"GITEA__database__DB_TYPE":"postgres","GITEA__database__HOST":"{{service.db.host}}:{{service.db.port}}","GITEA__database__NAME":"{{service.db.database}}","GITEA__database__USER":"{{service.db.user}}","GITEA__database__PASSWD":"{{service.db.password}}","GITEA__security__INSTALL_LOCK":"true","GITEA__security__SECRET_KEY":"{{secret(32)}}","GITEA__security__INTERNAL_TOKEN":"{{secret(64)}}","GITEA__server__DOMAIN":"{{DOMAIN:-localhost}}","GITEA__server__ROOT_URL":"{{ROOT_URL:-http://localhost:3000}}","GITEA__server__SSH_PORT":"2222","USER_UID":"1000","USER_GID":"1000"},
				 "volumes":[{"source":"gitea-data","target":"/data"}]}]}`,
			Variables:  `[{"key":"DOMAIN","label":"Public domain","default":"","required":false,"secret":false},{"key":"ROOT_URL","label":"Root URL","default":"","required":false,"secret":false}]`,
			IsOfficial: true,
		},
		{
			ID:          "tpl-nextcloud",
			Name:        "Nextcloud + PostgreSQL + Redis",
			Description: "Self-hosted file sync and collaboration with managed PostgreSQL and Redis",
			Category:    "stack",
			Logo:        "https://cdn.simpleicons.org/nextcloud",
			Config: `{"version":2,"services":[
				{"key":"db","type":"database","runtime":"postgresql","environment":{"POSTGRES_DB":"nextcloud","POSTGRES_USER":"nextcloud"},"volumes":[{"source":"nextcloud-db","target":"/var/lib/postgresql/data"}]},
				{"key":"redis","type":"database","runtime":"redis"},
				{"key":"nextcloud","type":"web","runtime":"nextcloud:latest","port":80,"depends_on":["db","redis"],
				 "environment":{"POSTGRES_HOST":"{{service.db.host}}","POSTGRES_DB":"{{service.db.database}}","POSTGRES_USER":"{{service.db.user}}","POSTGRES_PASSWORD":"{{service.db.password}}","REDIS_HOST":"{{service.redis.host}}","REDIS_HOST_PASSWORD":"{{service.redis.password}}","NEXTCLOUD_ADMIN_USER":"admin","NEXTCLOUD_ADMIN_PASSWORD":"{{secret(24)}}","NEXTCLOUD_TRUSTED_DOMAINS":"{{DOMAIN:-localhost}}","OVERWRITEHOST":"{{DOMAIN:-}}","OVERWRITEPROTOCOL":"https"},
				 "volumes":[{"source":"nextcloud-data","target":"/var/www/html"}]}]}`,
			Variables:  `[{"key":"DOMAIN","label":"Trusted domain","default":"localhost","required":false,"secret":false}]`,
			IsOfficial: true,
		},
		{
			ID:          "tpl-vaultwarden",
			Name:        "Vaultwarden + PostgreSQL",
			Description: "Bitwarden-compatible password manager with managed PostgreSQL",
			Category:    "stack",
			Logo:        "https://cdn.simpleicons.org/vaultwarden",
			Config: `{"version":2,"services":[
				{"key":"db","type":"database","runtime":"postgresql","environment":{"POSTGRES_DB":"vaultwarden","POSTGRES_USER":"vaultwarden"},"volumes":[{"source":"vaultwarden-db","target":"/var/lib/postgresql/data"}]},
				{"key":"vaultwarden","type":"web","runtime":"vaultwarden/server:latest","port":80,"health_check":"/alive","depends_on":["db"],
				 "environment":{"DATABASE_URL":"{{service.db.url}}","ADMIN_TOKEN":"{{secret(48)}}","DOMAIN":"{{DOMAIN:-http://localhost:80}}","SIGNUPS_ALLOWED":"false","WEBSOCKET_ENABLED":"true"},
				 "volumes":[{"source":"vaultwarden-data","target":"/data"}]}]}`,
			Variables:  `[{"key":"DOMAIN","label":"Public URL","default":"","required":false,"secret":false}]`,
			IsOfficial: true,
		},
		{
			ID:          "tpl-umami",
			Name:        "Umami + PostgreSQL",
			Description: "Lightweight privacy-first web analytics with managed PostgreSQL",
			Category:    "stack",
			Logo:        "https://cdn.simpleicons.org/umami",
			Config: `{"version":2,"services":[
				{"key":"db","type":"database","runtime":"postgresql","environment":{"POSTGRES_DB":"umami","POSTGRES_USER":"umami"},"volumes":[{"source":"umami-db","target":"/var/lib/postgresql/data"}]},
				{"key":"umami","type":"web","runtime":"ghcr.io/umami-software/umami:postgresql-latest","port":3000,"depends_on":["db"],
				 "environment":{"DATABASE_URL":"{{service.db.url}}","APP_SECRET":"{{secret(32)}}"}}]}`,
			Variables:  `[]`,
			IsOfficial: true,
		},
		{
			ID:          "tpl-immich",
			Name:        "Immich + PostgreSQL + Redis",
			Description: "Self-hosted photo and video backup with managed PostgreSQL and Redis",
			Category:    "stack",
			Logo:        "https://cdn.simpleicons.org/immich",
			Config: `{"version":2,"services":[
				{"key":"db","type":"database","runtime":"postgresql","environment":{"POSTGRES_DB":"immich","POSTGRES_USER":"immich"},"volumes":[{"source":"immich-db","target":"/var/lib/postgresql/data"}]},
				{"key":"redis","type":"database","runtime":"redis"},
				{"key":"ml","name":"immich-machine-learning","type":"worker","runtime":"ghcr.io/immich-app/immich-machine-learning:release",
				 "environment":{"DB_DATABASE_NAME":"{{service.db.database}}","DB_HOSTNAME":"{{service.db.host}}","DB_USERNAME":"{{service.db.user}}","DB_PASSWORD":"{{service.db.password}}","REDIS_HOSTNAME":"{{service.redis.host}}","REDIS_PASSWORD":"{{service.redis.password}}"},
				 "volumes":[{"source":"immich-model-cache","target":"/cache"}]},
				{"key":"immich","name":"immich-server","type":"web","runtime":"ghcr.io/immich-app/immich-server:release","port":2283,"health_check":"/api/server/ping","depends_on":["db","redis","ml"],
				 "environment":{"DB_DATABASE_NAME":"{{service.db.database}}","DB_HOSTNAME":"{{service.db.host}}","DB_USERNAME":"{{service.db.user}}","DB_PASSWORD":"{{service.db.password}}","REDIS_HOSTNAME":"{{service.redis.host}}","REDIS_PASSWORD":"{{service.redis.password}}"},
				 "volumes":[{"source":"immich-upload","target":"/usr/src/app/upload"}]}]}`,
			Variables:  `[]`,
			IsOfficial: true,
		},
	}
	return templates
}

func normalizeTemplateServiceType(templateType string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(templateType))
	if normalized == "" {
		return "web", nil
	}

	switch normalized {
	case "web", "worker", "database", "cron":
		return normalized, nil
	default:
		return "", fmt.Errorf("unsupported template service type: %s", templateType)
	}
}

func mergeTemplateVariables(
	defaultEnvironment map[string]string,
	templateVars []TemplateVariable,
	overrides map[string]string,
) (map[string]string, map[string]bool, []string) {
	env := make(map[string]string)
	secretKeys := make(map[string]bool)
	missingRequired := make([]string, 0)

	for key, value := range defaultEnvironment {
		trimmedKey := strings.TrimSpace(key)
		if trimmedKey == "" {
			continue
		}
		env[trimmedKey] = strings.TrimSpace(value)
	}

	templateByKey := make(map[string]TemplateVariable)
	for _, variable := range templateVars {
		key := strings.TrimSpace(variable.Key)
		if key == "" {
			continue
		}

		templateByKey[key] = variable
		secretKeys[key] = variable.Secret

		value := strings.TrimSpace(variable.Default)
		if override, exists := overrides[key]; exists {
			value = strings.TrimSpace(override)
		}

		if variable.Required && value == "" {
			missingRequired = append(missingRequired, key)
			continue
		}

		if value != "" {
			env[key] = value
		}
	}

	for key, override := range overrides {
		trimmedKey := strings.TrimSpace(key)
		if trimmedKey == "" {
			continue
		}

		value := strings.TrimSpace(override)
		if value == "" {
			continue
		}

		env[trimmedKey] = value
		if variable, exists := templateByKey[trimmedKey]; exists {
			secretKeys[trimmedKey] = variable.Secret
		}
	}

	return env, secretKeys, missingRequired
}

func resolveTemplateRuntimeImage(runtime string) string {
	normalized := strings.ToLower(strings.TrimSpace(runtime))
	if normalized == "" {
		return ""
	}
	if image, exists := templateRuntimeImageDefaults[normalized]; exists {
		return image
	}
	return runtime
}

func defaultTemplateResources(serviceType string) (cpu, memory string) {
	switch serviceType {
	case "database":
		return "1", "1Gi"
	default:
		return "0.5", "512Mi"
	}
}

// templateVisibleTo reports whether the caller may see a template: official and
// published (is_public) templates are public, other user templates are
// owner/admin only.
func templateVisibleTo(c *gin.Context, t ServiceTemplate) bool {
	if t.IsOfficial || t.IsPublic {
		return true
	}
	if contextIsAdmin(c) {
		return true
	}
	userID := optionalUserID(c)
	return userID != "" && t.OwnerID == userID
}

func mapSQLCTemplate(row sqlcdb.ServiceTemplate) ServiceTemplate {
	variables := "[]"
	if row.Variables.Valid && len(row.Variables.RawMessage) > 0 {
		variables = string(row.Variables.RawMessage)
	}

	ownerID := ""
	if row.OwnerID.Valid {
		ownerID = row.OwnerID.UUID.String()
	}

	return ServiceTemplate{
		ID:          row.ID,
		Name:        row.Name,
		Description: templateNullString(row.Description),
		Category:    row.Category,
		Logo:        templateNullString(row.Logo),
		Config:      string(row.Config),
		Variables:   variables,
		IsOfficial:  row.IsOfficial.Valid && row.IsOfficial.Bool,
		OwnerID:     ownerID,
		IsPublic:    row.IsPublic,
		CreatedAt:   templateNullTime(row.CreatedAt),
		UpdatedAt:   templateNullTime(row.UpdatedAt),
	}
}

func templateNullString(value sql.NullString) string {
	if value.Valid {
		return value.String
	}
	return ""
}

func templateNullTime(value sql.NullTime) time.Time {
	if value.Valid {
		return value.Time
	}
	return time.Time{}
}
