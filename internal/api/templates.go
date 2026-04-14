package api

import (
	"containr/internal/database"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

var composeVariablePattern = regexp.MustCompile(`\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:-|-|:\?|\?)([^}]*))?\}`)

var defaultComposePaths = []string{
	"docker-compose.yml",
	"docker-compose.yaml",
	"compose.yml",
	"compose.yaml",
}

type ServiceTemplate struct {
	ID           string    `json:"id" db:"id"`
	Name         string    `json:"name" db:"name"`
	Description  string    `json:"description" db:"description"`
	Category     string    `json:"category" db:"category"`
	Logo         string    `json:"logo" db:"logo"`
	Config       string    `json:"config" db:"config"`
	Variables    string    `json:"variables" db:"variables"`
	Screenshots  string    `json:"screenshots" db:"screenshots"`
	ComposeYAML  string    `json:"compose_yaml,omitempty" db:"compose_yaml"`
	IsOfficial   bool      `json:"is_official" db:"is_official"`
	SourceType   string    `json:"source_type" db:"source_type"`
	SourceRepo   string    `json:"source_repo,omitempty" db:"source_repo"`
	SourceBranch string    `json:"source_branch,omitempty" db:"source_branch"`
	SourcePath   string    `json:"source_path,omitempty" db:"source_path"`
	SourceURL    string    `json:"source_url,omitempty" db:"source_url"`
	CreatedBy    string    `json:"created_by,omitempty" db:"created_by"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
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

type ComposeTemplateConfig struct {
	Type         string                  `json:"type"`
	Format       string                  `json:"format"`
	ComposeFile  string                  `json:"compose_file,omitempty"`
	ServiceCount int                     `json:"service_count"`
	Services     []ComposeServiceSummary `json:"services"`
}

type ComposeServiceSummary struct {
	Name         string            `json:"name"`
	Type         string            `json:"type"`
	Image        string            `json:"image,omitempty"`
	BuildContext string            `json:"build_context,omitempty"`
	Command      string            `json:"command,omitempty"`
	Ports        []string          `json:"ports,omitempty"`
	Environment  map[string]string `json:"environment,omitempty"`
	DependsOn    []string          `json:"depends_on,omitempty"`
}

type TemplateVariable struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Default     string `json:"default"`
	Required    bool   `json:"required"`
	Secret      bool   `json:"secret"`
	Description string `json:"description"`
}

type ImportGitHubTemplateRequest struct {
	ProviderID   string `json:"provider_id"`
	RepoFullName string `json:"repo_full_name"`
	SourceURL    string `json:"source_url"`
	Branch       string `json:"branch"`
	ComposePath  string `json:"compose_path"`
	ManifestPath string `json:"manifest_path"` // Backward-compatible alias for older clients.
}

type ImportComposeTemplateRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	SourceURL   string `json:"source_url"`
	ComposeYAML string `json:"compose_yaml" binding:"required"`
}

type parsedComposeTemplate struct {
	Name        string
	Description string
	Category    string
	Logo        string
	Screenshots []string
	Variables   []TemplateVariable
	Config      ComposeTemplateConfig
	ComposeYAML string
}

func handleGetTemplates(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	category := c.Query("category")

	query := `SELECT id, name, COALESCE(description, ''), category, COALESCE(logo, ''), config, variables,
		COALESCE(screenshots, '[]'), COALESCE(compose_yaml, ''), is_official,
		COALESCE(source_type, CASE WHEN is_official THEN 'official' ELSE 'community' END),
		COALESCE(source_repo, ''), COALESCE(source_branch, ''), COALESCE(source_path, ''),
		COALESCE(source_url, ''), COALESCE(created_by::text, ''), created_at, updated_at
		FROM service_templates`
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
		err := rows.Scan(
			&t.ID, &t.Name, &t.Description, &t.Category, &t.Logo, &t.Config, &t.Variables,
			&t.Screenshots, &t.ComposeYAML, &t.IsOfficial, &t.SourceType, &t.SourceRepo, &t.SourceBranch, &t.SourcePath,
			&t.SourceURL, &t.CreatedBy, &t.CreatedAt, &t.UpdatedAt,
		)
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

	template, err := getTemplateByID(db, templateID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	var config map[string]interface{}
	_ = json.Unmarshal([]byte(template.Config), &config)

	var variables []TemplateVariable
	_ = json.Unmarshal([]byte(template.Variables), &variables)

	var screenshots []string
	_ = json.Unmarshal([]byte(template.Screenshots), &screenshots)

	c.JSON(http.StatusOK, gin.H{
		"template":    template,
		"config":      config,
		"variables":   variables,
		"screenshots": screenshots,
	})
}

func handleImportGitHubTemplate(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)

	var req ImportGitHubTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.ComposePath == "" && req.ManifestPath != "" {
		req.ComposePath = req.ManifestPath
	}

	if repo, branch, composePath, ok := parseGitHubTemplateReference(req.SourceURL); ok {
		if req.RepoFullName == "" {
			req.RepoFullName = repo
		}
		if req.Branch == "" {
			req.Branch = branch
		}
		if req.ComposePath == "" {
			req.ComposePath = composePath
		}
	}

	if req.RepoFullName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "GitHub repository is required"})
		return
	}

	provider := GitProvider{Name: "github", APIUrl: "https://api.github.com"}
	if req.ProviderID != "" {
		err := db.QueryRow(`
			SELECT id, name, access_token, api_url
			FROM git_providers
			WHERE id = $1 AND user_id = $2
		`, req.ProviderID, userID).Scan(&provider.ID, &provider.Name, &provider.AccessToken, &provider.APIUrl)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Git provider not found"})
			return
		}
	}

	if req.Branch == "" {
		details, err := fetchGitRepositoryDetails(provider.Name, req.RepoFullName, provider.AccessToken, provider.APIUrl)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read repository: " + err.Error()})
			return
		}
		if branch, ok := details["default_branch"].(string); ok && branch != "" {
			req.Branch = branch
		} else {
			req.Branch = "main"
		}
	}

	composePath := req.ComposePath
	rawCompose, err := fetchGitHubCompose(provider, req.RepoFullName, req.Branch, composePath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to fetch Docker Compose file: " + err.Error()})
		return
	}
	if composePath == "" {
		composePath = detectComposePath(rawCompose.path)
	}

	parsed, err := parseComposeTemplate(rawCompose.content, composePath, req.RepoFullName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sourceURL := req.SourceURL
	if sourceURL == "" {
		sourceURL = "https://github.com/" + req.RepoFullName + "/blob/" + req.Branch + "/" + composePath
	}

	template, err := insertComposeTemplate(db, parsed, insertComposeTemplateOptions{
		UserID:       userID,
		SourceType:   "github",
		SourceRepo:   req.RepoFullName,
		SourceBranch: req.Branch,
		SourcePath:   composePath,
		SourceURL:    sourceURL,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to import template"})
		return
	}

	LogAuditWithRequest(c, "template", template.ID, "import", map[string]interface{}{
		"source":       "github",
		"repo":         req.RepoFullName,
		"branch":       req.Branch,
		"compose_path": composePath,
	})

	c.JSON(http.StatusCreated, gin.H{"template": template})
}

func handleImportComposeTemplate(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)

	var req ImportComposeTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	parsed, err := parseComposeTemplate([]byte(req.ComposeYAML), "docker-compose.yml", req.Name)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.Name) != "" {
		parsed.Name = strings.TrimSpace(req.Name)
	}
	if strings.TrimSpace(req.Description) != "" {
		parsed.Description = strings.TrimSpace(req.Description)
	}
	if strings.TrimSpace(req.Category) != "" {
		parsed.Category = strings.TrimSpace(req.Category)
	}

	template, err := insertComposeTemplate(db, parsed, insertComposeTemplateOptions{
		UserID:     userID,
		SourceType: "manual",
		SourceURL:  req.SourceURL,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to import template"})
		return
	}

	LogAuditWithRequest(c, "template", template.ID, "import", map[string]interface{}{
		"source": "manual",
	})

	c.JSON(http.StatusCreated, gin.H{"template": template})
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

	var projectOwner string
	if err := db.QueryRow("SELECT owner_id FROM projects WHERE id = $1", req.ProjectID).Scan(&projectOwner); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	if projectOwner != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	template, err := getTemplateByID(db, templateID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	if strings.TrimSpace(template.ComposeYAML) != "" {
		serviceIDs, err := createServicesFromComposeTemplate(db, req.ProjectID, req.Name, template, req.Variables)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to install template: " + err.Error()})
			return
		}

		LogAuditWithRequest(c, "template", templateID, "install", map[string]interface{}{
			"project_id":  req.ProjectID,
			"name":        req.Name,
			"service_ids": serviceIDs,
		})

		firstID := ""
		if len(serviceIDs) > 0 {
			firstID = serviceIDs[0]
		}
		c.JSON(http.StatusCreated, gin.H{
			"service_id":   firstID,
			"service_ids":  serviceIDs,
			"message":      "Template installed from Docker Compose",
			"serviceCount": len(serviceIDs),
		})
		return
	}

	serviceID, err := createLegacyTemplateService(db, req.ProjectID, req.Name, template, req.Variables)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create service from template"})
		return
	}

	LogAuditWithRequest(c, "service", serviceID, "create", map[string]interface{}{
		"template_id": templateID,
		"name":        req.Name,
	})

	c.JSON(http.StatusCreated, gin.H{
		"service_id":  serviceID,
		"service_ids": []string{serviceID},
		"message":     "Service created from template",
	})
}

type insertComposeTemplateOptions struct {
	UserID       string
	SourceType   string
	SourceRepo   string
	SourceBranch string
	SourcePath   string
	SourceURL    string
}

func insertComposeTemplate(db *database.DB, parsed parsedComposeTemplate, opts insertComposeTemplateOptions) (ServiceTemplate, error) {
	configJSON, _ := json.Marshal(parsed.Config)
	variablesJSON, _ := json.Marshal(parsed.Variables)
	screenshotsJSON, _ := json.Marshal(parsed.Screenshots)
	templateID := "compose-" + uuid.New().String()
	now := time.Now()

	var template ServiceTemplate
	err := db.QueryRow(
		`INSERT INTO service_templates
			(id, name, description, category, logo, config, variables, screenshots, compose_yaml, is_official,
			 source_type, source_repo, source_branch, source_path, source_url, created_by, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, $11, $12, $13, $14, $15, $16, $16)
		 RETURNING id, name, COALESCE(description, ''), category, COALESCE(logo, ''), config, variables,
			COALESCE(screenshots, '[]'), COALESCE(compose_yaml, ''), is_official,
			COALESCE(source_type, ''), COALESCE(source_repo, ''), COALESCE(source_branch, ''), COALESCE(source_path, ''),
			COALESCE(source_url, ''), COALESCE(created_by::text, ''), created_at, updated_at`,
		templateID, parsed.Name, parsed.Description, parsed.Category, parsed.Logo, string(configJSON), string(variablesJSON),
		string(screenshotsJSON), parsed.ComposeYAML, opts.SourceType, opts.SourceRepo, opts.SourceBranch,
		opts.SourcePath, opts.SourceURL, opts.UserID, now,
	).Scan(
		&template.ID, &template.Name, &template.Description, &template.Category, &template.Logo,
		&template.Config, &template.Variables, &template.Screenshots, &template.ComposeYAML, &template.IsOfficial,
		&template.SourceType, &template.SourceRepo, &template.SourceBranch, &template.SourcePath, &template.SourceURL,
		&template.CreatedBy, &template.CreatedAt, &template.UpdatedAt,
	)

	return template, err
}

func getTemplateByID(db *database.DB, templateID string) (ServiceTemplate, error) {
	var template ServiceTemplate
	err := db.QueryRow(
		`SELECT id, name, COALESCE(description, ''), category, COALESCE(logo, ''), config, variables,
			COALESCE(screenshots, '[]'), COALESCE(compose_yaml, ''), is_official,
			COALESCE(source_type, CASE WHEN is_official THEN 'official' ELSE 'community' END),
			COALESCE(source_repo, ''), COALESCE(source_branch, ''), COALESCE(source_path, ''),
			COALESCE(source_url, ''), COALESCE(created_by::text, ''), created_at, updated_at
		 FROM service_templates WHERE id = $1`,
		templateID,
	).Scan(
		&template.ID, &template.Name, &template.Description, &template.Category, &template.Logo,
		&template.Config, &template.Variables, &template.Screenshots, &template.ComposeYAML, &template.IsOfficial,
		&template.SourceType, &template.SourceRepo, &template.SourceBranch, &template.SourcePath,
		&template.SourceURL, &template.CreatedBy, &template.CreatedAt, &template.UpdatedAt,
	)
	return template, err
}

type fetchedComposeFile struct {
	path    string
	content []byte
}

func fetchGitHubCompose(provider GitProvider, repoFullName, branch, composePath string) (fetchedComposeFile, error) {
	if strings.TrimSpace(composePath) != "" {
		content, err := fetchGitHubFile(provider.Name, provider.AccessToken, provider.APIUrl, repoFullName, branch, composePath)
		return fetchedComposeFile{path: composePath, content: content}, err
	}

	var lastErr error
	for _, candidate := range defaultComposePaths {
		content, err := fetchGitHubFile(provider.Name, provider.AccessToken, provider.APIUrl, repoFullName, branch, candidate)
		if err == nil {
			return fetchedComposeFile{path: candidate, content: content}, nil
		}
		lastErr = err
	}
	if lastErr != nil {
		return fetchedComposeFile{}, fmt.Errorf("no Compose file found in repository root: %w", lastErr)
	}
	return fetchedComposeFile{}, fmt.Errorf("no Compose file found in repository root")
}

func detectComposePath(value string) string {
	if value != "" {
		return value
	}
	return "docker-compose.yml"
}

func parseComposeTemplate(raw []byte, composePath string, fallbackName string) (parsedComposeTemplate, error) {
	var root map[string]interface{}
	if err := yaml.Unmarshal(raw, &root); err != nil {
		return parsedComposeTemplate{}, fmt.Errorf("Docker Compose YAML is not valid")
	}

	servicesMap := asMap(root["services"])
	if len(servicesMap) == 0 {
		return parsedComposeTemplate{}, fmt.Errorf("Docker Compose file must include at least one service")
	}

	meta := mergeMetadata(asMap(root["x-casaos"]), asMap(root["x-containr"]))
	services := make([]ComposeServiceSummary, 0, len(servicesMap))
	for name, rawService := range servicesMap {
		serviceMap := asMap(rawService)
		service := ComposeServiceSummary{
			Name:         name,
			Image:        stringValue(serviceMap["image"]),
			BuildContext: buildContextValue(serviceMap["build"]),
			Command:      commandValue(serviceMap["command"]),
			Ports:        stringSliceValue(serviceMap["ports"]),
			Environment:  environmentValue(serviceMap["environment"]),
			DependsOn:    stringSliceValue(serviceMap["depends_on"]),
		}
		service.Type = inferComposeServiceType(service)
		services = append(services, service)
	}
	sort.Slice(services, func(i, j int) bool { return services[i].Name < services[j].Name })

	variables := collectComposeVariables(string(raw))
	name := firstTemplateNonEmpty(
		stringFromMetadata(meta, "name", "title"),
		stringValue(root["name"]),
		humanizeTemplateName(fallbackName),
		humanizeTemplateName(strings.TrimSuffix(path.Base(composePath), path.Ext(composePath))),
	)
	description := firstTemplateNonEmpty(
		stringFromMetadata(meta, "description", "desc"),
		fmt.Sprintf("%s stack with %d Compose services.", name, len(services)),
	)
	category := firstTemplateNonEmpty(stringFromMetadata(meta, "category", "class"), inferComposeCategory(services))
	logo := firstTemplateNonEmpty(stringFromMetadata(meta, "icon", "logo", "thumbnail"), "")
	screenshots := stringListFromMetadata(meta, "screenshots", "screenshot", "screenshot_link", "screenshot_links")

	return parsedComposeTemplate{
		Name:        name,
		Description: description,
		Category:    category,
		Logo:        logo,
		Screenshots: screenshots,
		Variables:   variables,
		ComposeYAML: string(raw),
		Config: ComposeTemplateConfig{
			Type:         "compose",
			Format:       "docker-compose",
			ComposeFile:  composePath,
			ServiceCount: len(services),
			Services:     services,
		},
	}, nil
}

func createServicesFromComposeTemplate(db *database.DB, projectID, installName string, template ServiceTemplate, variables map[string]string) ([]string, error) {
	var config ComposeTemplateConfig
	if err := json.Unmarshal([]byte(template.Config), &config); err != nil {
		return nil, err
	}
	if len(config.Services) == 0 {
		parsed, err := parseComposeTemplate([]byte(template.ComposeYAML), template.SourcePath, template.Name)
		if err != nil {
			return nil, err
		}
		config = parsed.Config
	}

	serviceIDs := make([]string, 0, len(config.Services))
	now := time.Now()
	for _, composeService := range config.Services {
		serviceID := uuid.New()
		serviceName := installName
		if len(config.Services) > 1 {
			serviceName = installName + "-" + composeService.Name
		}
		serviceType := composeService.Type
		if serviceType == "" {
			serviceType = "web"
		}
		image := substituteComposeVariables(firstTemplateNonEmpty(composeService.Image, composeService.BuildContext), variables)
		command := substituteComposeVariables(composeService.Command, variables)
		cpu := "0.5"
		memory := "512Mi"
		if serviceType == "database" {
			cpu = "1"
			memory = "1Gi"
		}

		_, err := db.Exec(
			`INSERT INTO services (id, project_id, name, type, status, image, command, environment, cpu, memory, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
			serviceID, projectID, serviceName, serviceType, "stopped", image, command, "production", cpu, memory, now, now,
		)
		if err != nil {
			return serviceIDs, err
		}

		for key, value := range composeService.Environment {
			resolved := substituteComposeVariables(value, variables)
			if explicit, ok := variables[key]; ok {
				resolved = explicit
			}
			_, _ = db.Exec(
				`INSERT INTO environment_variables (id, service_id, key, value, is_secret, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)
				 ON CONFLICT (service_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
				uuid.New(), serviceID, key, resolved, isSecretVariable(key), now, now,
			)
		}

		serviceIDs = append(serviceIDs, serviceID.String())
	}

	return serviceIDs, nil
}

func createLegacyTemplateService(db *database.DB, projectID, serviceName string, template ServiceTemplate, variables map[string]string) (string, error) {
	var config TemplateConfig
	_ = json.Unmarshal([]byte(template.Config), &config)

	envVars := make(map[string]string)
	for key, value := range config.Environment {
		envVars[key] = value
	}
	for key, value := range variables {
		envVars[key] = value
	}

	envVarsJSON, _ := json.Marshal(envVars)
	serviceID := uuid.New()
	now := time.Now()

	_, err := db.Exec(
		`INSERT INTO services (id, project_id, name, type, status, image, command, environment, cpu, memory, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		serviceID, projectID, serviceName, config.Type, "stopped", config.Runtime, config.StartCommand,
		string(envVarsJSON), "0.5", "512Mi", now, now,
	)
	if err != nil {
		return "", err
	}
	return serviceID.String(), nil
}

func collectComposeVariables(raw string) []TemplateVariable {
	matches := composeVariablePattern.FindAllStringSubmatch(raw, -1)
	seen := make(map[string]TemplateVariable)
	for _, match := range matches {
		key := match[1]
		defaultValue := ""
		required := true
		if len(match) > 3 && match[3] != "" {
			defaultValue = match[3]
			required = false
		}
		if existing, ok := seen[key]; ok {
			if existing.Default == "" && defaultValue != "" {
				existing.Default = defaultValue
				existing.Required = false
				seen[key] = existing
			}
			continue
		}
		seen[key] = TemplateVariable{
			Key:      key,
			Label:    humanizeTemplateName(key),
			Default:  defaultValue,
			Required: required,
			Secret:   isSecretVariable(key),
		}
	}

	keys := make([]string, 0, len(seen))
	for key := range seen {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	variables := make([]TemplateVariable, 0, len(keys))
	for _, key := range keys {
		variables = append(variables, seen[key])
	}
	return variables
}

func substituteComposeVariables(value string, variables map[string]string) string {
	return composeVariablePattern.ReplaceAllStringFunc(value, func(match string) string {
		parts := composeVariablePattern.FindStringSubmatch(match)
		if len(parts) < 2 {
			return match
		}
		if variables != nil {
			if explicit, ok := variables[parts[1]]; ok {
				return explicit
			}
		}
		if len(parts) > 3 {
			return parts[3]
		}
		return ""
	})
}

func parseGitHubTemplateReference(rawURL string) (repoFullName, branch, composePath string, ok bool) {
	if strings.TrimSpace(rawURL) == "" {
		return "", "", "", false
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", "", "", false
	}

	host := strings.ToLower(parsed.Host)
	parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	if host == "github.com" && len(parts) >= 2 {
		repoFullName = parts[0] + "/" + parts[1]
		if len(parts) >= 5 && (parts[2] == "blob" || parts[2] == "tree") {
			branch = parts[3]
			composePath = strings.Join(parts[4:], "/")
		}
		return repoFullName, branch, composePath, true
	}
	if host == "raw.githubusercontent.com" && len(parts) >= 4 {
		repoFullName = parts[0] + "/" + parts[1]
		branch = parts[2]
		composePath = strings.Join(parts[3:], "/")
		return repoFullName, branch, composePath, true
	}

	return "", "", "", false
}

func asMap(value interface{}) map[string]interface{} {
	switch typed := value.(type) {
	case map[string]interface{}:
		return typed
	case map[interface{}]interface{}:
		result := make(map[string]interface{}, len(typed))
		for key, value := range typed {
			result[fmt.Sprint(key)] = value
		}
		return result
	default:
		return map[string]interface{}{}
	}
}

func mergeMetadata(primary, secondary map[string]interface{}) map[string]interface{} {
	result := map[string]interface{}{}
	for key, value := range primary {
		result[strings.ToLower(key)] = value
	}
	for key, value := range secondary {
		result[strings.ToLower(key)] = value
	}
	return result
}

func stringFromMetadata(metadata map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value := stringValue(metadata[strings.ToLower(key)]); value != "" {
			return value
		}
	}
	return ""
}

func stringListFromMetadata(metadata map[string]interface{}, keys ...string) []string {
	for _, key := range keys {
		values := stringSliceValue(metadata[strings.ToLower(key)])
		if len(values) > 0 {
			return values
		}
	}
	return []string{}
}

func stringValue(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case int, int64, float64, bool:
		return strings.TrimSpace(fmt.Sprint(typed))
	default:
		return ""
	}
}

func stringSliceValue(value interface{}) []string {
	switch typed := value.(type) {
	case []string:
		return typed
	case []interface{}:
		result := make([]string, 0, len(typed))
		for _, item := range typed {
			if text := stringValue(item); text != "" {
				result = append(result, text)
			}
		}
		return result
	case map[string]interface{}:
		result := make([]string, 0, len(typed))
		for key := range typed {
			result = append(result, key)
		}
		sort.Strings(result)
		return result
	case map[interface{}]interface{}:
		return stringSliceValue(asMap(typed))
	case string:
		if strings.TrimSpace(typed) == "" {
			return []string{}
		}
		return []string{strings.TrimSpace(typed)}
	default:
		return []string{}
	}
}

func environmentValue(value interface{}) map[string]string {
	result := map[string]string{}
	switch typed := value.(type) {
	case map[string]interface{}:
		for key, value := range typed {
			result[key] = stringValue(value)
		}
	case map[interface{}]interface{}:
		return environmentValue(asMap(typed))
	case []interface{}:
		for _, item := range typed {
			text := stringValue(item)
			if text == "" {
				continue
			}
			key, value, ok := strings.Cut(text, "=")
			if ok {
				result[key] = value
			} else {
				result[text] = "${" + text + "}"
			}
		}
	}
	return result
}

func buildContextValue(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case map[string]interface{}:
		return firstTemplateNonEmpty(stringValue(typed["context"]), stringValue(typed["dockerfile"]))
	case map[interface{}]interface{}:
		return buildContextValue(asMap(typed))
	default:
		return ""
	}
}

func commandValue(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case []interface{}:
		parts := make([]string, 0, len(typed))
		for _, item := range typed {
			if text := stringValue(item); text != "" {
				parts = append(parts, text)
			}
		}
		return strings.Join(parts, " ")
	default:
		return ""
	}
}

func inferComposeServiceType(service ComposeServiceSummary) string {
	lower := strings.ToLower(service.Name + " " + service.Image)
	for _, marker := range []string{"postgres", "mysql", "mariadb", "mongo", "redis", "clickhouse", "influxdb"} {
		if strings.Contains(lower, marker) {
			return "database"
		}
	}
	if len(service.Ports) == 0 {
		return "worker"
	}
	return "web"
}

func inferComposeCategory(services []ComposeServiceSummary) string {
	if len(services) == 1 && services[0].Type == "database" {
		return "database"
	}
	for _, service := range services {
		if service.Type == "web" {
			return "web"
		}
	}
	return "community"
}

func isSecretVariable(key string) bool {
	upper := strings.ToUpper(key)
	for _, marker := range []string{"PASSWORD", "SECRET", "TOKEN", "API_KEY", "PRIVATE_KEY", "KEY_BASE"} {
		if strings.Contains(upper, marker) {
			return true
		}
	}
	return false
}

func humanizeTemplateName(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimSuffix(value, ".git")
	if strings.Contains(value, "/") {
		parts := strings.Split(value, "/")
		value = parts[len(parts)-1]
	}
	value = strings.ReplaceAll(value, "_", " ")
	value = strings.ReplaceAll(value, "-", " ")
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	words := strings.Fields(value)
	for index, word := range words {
		if len(word) == 0 {
			continue
		}
		words[index] = strings.ToUpper(word[:1]) + word[1:]
	}
	return strings.Join(words, " ")
}

func firstTemplateNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func SeedTemplates() []ServiceTemplate {
	templates := []ServiceTemplate{
		{
			ID:          "tpl-postgres-compose",
			Name:        "PostgreSQL",
			Description: "Single-service PostgreSQL Compose template.",
			Category:    "database",
			Logo:        "https://cdn.simpleicons.org/postgresql",
			Config:      `{"type":"compose","format":"docker-compose","service_count":1,"services":[{"name":"postgres","type":"database","image":"postgres:16","ports":["${POSTGRES_PORT:-5432}:5432"],"environment":{"POSTGRES_USER":"${POSTGRES_USER:-postgres}","POSTGRES_PASSWORD":"${POSTGRES_PASSWORD}","POSTGRES_DB":"${POSTGRES_DB:-app}"}}]}`,
			Variables:   `[{"key":"POSTGRES_DB","label":"Postgres Db","default":"app","required":false,"secret":false},{"key":"POSTGRES_PASSWORD","label":"Postgres Password","default":"","required":true,"secret":true},{"key":"POSTGRES_PORT","label":"Postgres Port","default":"5432","required":false,"secret":false},{"key":"POSTGRES_USER","label":"Postgres User","default":"postgres","required":false,"secret":false}]`,
			Screenshots: `[]`,
			ComposeYAML: "services:\n  postgres:\n    image: postgres:16\n    ports:\n      - \"${POSTGRES_PORT:-5432}:5432\"\n    environment:\n      POSTGRES_USER: \"${POSTGRES_USER:-postgres}\"\n      POSTGRES_PASSWORD: \"${POSTGRES_PASSWORD}\"\n      POSTGRES_DB: \"${POSTGRES_DB:-app}\"\n",
			IsOfficial:  true,
			SourceType:  "official",
		},
	}
	return templates
}
