package api

import (
	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ServiceTemplate struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Category    string    `json:"category" db:"category"`
	Logo        string    `json:"logo" db:"logo"`
	Config      string    `json:"config" db:"config"`
	Variables   string    `json:"variables" db:"variables"`
	IsOfficial  bool      `json:"is_official" db:"is_official"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type TemplateConfig struct {
	Type           string            `json:"type"`
	Runtime        string            `json:"runtime"`
	BuildCommand   string            `json:"build_command"`
	StartCommand   string            `json:"start_command"`
	Port           int               `json:"port"`
	HealthCheck    string            `json:"health_check"`
	Environment    map[string]string `json:"environment"`
	Dockerfile     string            `json:"dockerfile,omitempty"`
	NixpacksConfig map[string]string `json:"nixpacks_config,omitempty"`
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

	var templateRows []sqlcdb.ServiceTemplate
	var err error
	if category != "" {
		templateRows, err = queries.ListServiceTemplatesByCategory(ctx, category)
	} else {
		templateRows, err = queries.ListServiceTemplates(ctx)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch templates"})
		return
	}

	templates := make([]ServiceTemplate, 0, len(templateRows))
	for _, row := range templateRows {
		templates = append(templates, mapSQLCTemplate(row))
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
			c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch template"})
		return
	}

	t := mapSQLCTemplate(row)
	if t.ID == "" {
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
		Name      string            `json:"name" binding:"required"`
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
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

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
	if ownerID.String() != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	templateRow, err := queries.GetServiceTemplateByID(ctx, templateID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch template"})
		return
	}

	template := mapSQLCTemplate(templateRow)
	if template.ID == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
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
	cpu, memory := defaultTemplateResources(serviceType)
	serviceEnvironment := "production"

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
		ID:          serviceID,
		ProjectID:   projectID,
		Name:        req.Name,
		Type:        serviceType,
		Status:      "stopped",
		Image:       sql.NullString{String: serviceImage, Valid: true},
		Command:     sql.NullString{String: serviceCommand, Valid: true},
		Environment: sql.NullString{String: serviceEnvironment, Valid: true},
		Cpu:         sql.NullString{String: cpu, Valid: true},
		Memory:      sql.NullString{String: memory, Valid: true},
		CreatedAt:   sql.NullTime{Time: now, Valid: true},
		UpdatedAt:   sql.NullTime{Time: now, Valid: true},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create service from template"})
		return
	}

	for key, value := range envVars {
		if strings.TrimSpace(key) == "" {
			continue
		}

		err = txQueries.UpsertEnvironmentVariable(ctx, sqlcdb.UpsertEnvironmentVariableParams{
			ID:        uuid.New(),
			ServiceID: serviceID,
			Key:       key,
			Value:     value,
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
			Logo:        "https://cdn.simpleicons.org/terminal",
			Config:      `{"type":"worker","runtime":"node","build_command":"npm install","start_command":"npm run worker"}`,
			Variables:   `[{"key":"WORKER_CONCURRENCY","label":"Concurrency","default":"4","required":false,"secret":false}]`,
			IsOfficial:  true,
		},
		{
			ID:          "tpl-cron",
			Name:        "Cron Job",
			Description: "Scheduled task runner",
			Category:    "cron",
			Logo:        "https://cdn.simpleicons.org/clock",
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

func mapSQLCTemplate(row sqlcdb.ServiceTemplate) ServiceTemplate {
	variables := "[]"
	if row.Variables.Valid && len(row.Variables.RawMessage) > 0 {
		variables = string(row.Variables.RawMessage)
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
