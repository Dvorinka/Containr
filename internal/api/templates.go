package api

import (
	"containr/internal/database"
	"encoding/json"
	"net/http"
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

func handleGetTemplates(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	category := c.Query("category")

	query := "SELECT id, name, description, category, logo, config, variables, is_official, created_at, updated_at FROM service_templates"
	args := []interface{}{}

	if category != "" {
		query += " WHERE category = $1"
		args = append(args, category)
	}
	query += " ORDER BY is_official DESC, name ASC"

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch templates"})
		return
	}
	defer rows.Close()

	var templates []ServiceTemplate
	for rows.Next() {
		var t ServiceTemplate
		err := rows.Scan(&t.ID, &t.Name, &t.Description, &t.Category, &t.Logo, &t.Config, &t.Variables, &t.IsOfficial, &t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			continue
		}
		templates = append(templates, t)
	}

	c.JSON(http.StatusOK, gin.H{"templates": templates})
}

func handleGetTemplate(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	templateID := c.Param("id")

	var t ServiceTemplate
	err := db.QueryRow(
		"SELECT id, name, description, category, logo, config, variables, is_official, created_at, updated_at FROM service_templates WHERE id = $1",
		templateID,
	).Scan(&t.ID, &t.Name, &t.Description, &t.Category, &t.Logo, &t.Config, &t.Variables, &t.IsOfficial, &t.CreatedAt, &t.UpdatedAt)

	if err != nil {
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
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)

	templateID := c.Param("id")

	var req struct {
		ProjectID string            `json:"project_id" binding:"required"`
		Name      string            `json:"name" binding:"required"`
		Variables map[string]string `json:"variables"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var template ServiceTemplate
	err := db.QueryRow(
		"SELECT id, name, description, category, logo, config, variables, is_official FROM service_templates WHERE id = $1",
		templateID,
	).Scan(&template.ID, &template.Name, &template.Description, &template.Category, &template.Logo, &template.Config, &template.Variables, &template.IsOfficial)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	var config TemplateConfig
	json.Unmarshal([]byte(template.Config), &config)

	var templateVars []TemplateVariable
	json.Unmarshal([]byte(template.Variables), &templateVars)

	envVars := make(map[string]string)
	for key, value := range config.Environment {
		envVars[key] = value
	}
	for key, value := range req.Variables {
		envVars[key] = value
	}

	envVarsJSON, _ := json.Marshal(envVars)

	serviceID := uuid.New()
	now := time.Now()

	_, err = db.Exec(
		`INSERT INTO services (id, project_id, name, type, status, image, command, environment, cpu, memory, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		serviceID, req.ProjectID, req.Name, config.Type, "stopped", config.Runtime, config.StartCommand,
		string(envVarsJSON), "0.5", "512Mi", now, now,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create service from template"})
		return
	}

	LogAudit(userID, "service", serviceID.String(), "create", map[string]interface{}{
		"template_id": templateID,
		"name":        req.Name,
	})

	c.JSON(http.StatusCreated, gin.H{
		"service_id": serviceID.String(),
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
