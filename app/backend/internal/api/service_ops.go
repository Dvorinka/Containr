package api

import (
	"net/http"
	"strings"
	"time"

	"containr/internal/database"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CloneServiceRequest struct {
	Name        string    `json:"name"`
	ProjectID   uuid.UUID `json:"project_id"` // empty = clone within the same project
	Environment string    `json:"environment" binding:"omitempty,oneof=production preview development"`
}

// handleCloneService duplicates a service's full configuration — image/git
// source, volumes, domains, access gates, builder settings, and variables —
// into the same or another project. Containers are not cloned; the copy
// starts stopped until its first deploy.
func handleCloneService(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	userID, _ := c.Get("user_id")

	var req CloneServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}

	source, ok := loadOwnedService(c, db.(*database.DB))
	if !ok {
		return
	}

	targetProjectID := source.ProjectID
	if req.ProjectID != uuid.Nil {
		targetProjectID = req.ProjectID
	}
	if !ownsProject(db.(*database.DB), targetProjectID, userID.(string), contextIsAdmin(c)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to target project", "code": "FORBIDDEN"})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = source.Name + "-copy"
	}
	var count int
	_ = db.(*database.DB).QueryRow(
		`SELECT COUNT(*) FROM services WHERE project_id = $1 AND name = $2`,
		targetProjectID, name,
	).Scan(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Service name already exists in target project", "code": "CONFLICT"})
		return
	}

	environment := source.Environment
	if req.Environment != "" {
		environment = req.Environment
	}

	newID, err := cloneServiceRow(db.(*database.DB), source.ID, targetProjectID, name, environment)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clone service"})
		return
	}

	LogAuditWithRequest(c, "service", source.ID.String(), "service.clone", map[string]interface{}{"cloned_to": newID.String(), "name": name})
	c.JSON(http.StatusCreated, gin.H{"service_id": newID, "name": name, "message": "Service cloned"})
}

// cloneServiceRow copies a service's full configuration — source, build
// settings, volumes, access gates, domains, and variables — under a new id
// in the target project. The clone starts stopped. An empty environment
// inherits the source's. Used by the clone endpoint and preview
// environments, which additionally override git_branch and domains.
func cloneServiceRow(db *database.DB, sourceID uuid.UUID, targetProjectID uuid.UUID, name, environment string) (uuid.UUID, error) {
	var sourceEnv string
	if err := db.QueryRow(`SELECT COALESCE(environment, '') FROM services WHERE id = $1`, sourceID).Scan(&sourceEnv); err != nil {
		return uuid.Nil, err
	}
	if environment == "" {
		environment = sourceEnv
	}
	if environment == "" {
		environment = "production"
	}
	environmentID, err := getProjectEnvironmentID(db, targetProjectID, environment)
	if err != nil {
		return uuid.Nil, err
	}

	maintenance, basicAuth := serviceAccess(db, sourceID)
	newID := uuid.New()
	now := time.Now()
	// string() so pq sends text — []byte would go as bytea and fail ::jsonb.
	volumesJSON := string(loadServiceVolumesJSON(db, sourceID))

	_, err = db.Exec(
		`INSERT INTO services
			(id, project_id, name, environment_id, service_type, source_type, source_url, image_name,
				 build_command, start_command, type, status, image, command, environment,
				 git_repo, git_branch, build_path, cpu, memory, replicas, port, domain,
				 healthcheck_path, restart_policy, volumes, maintenance_mode, basic_auth_users,
				 builder, cpu_reserve, memory_reserve, static_build_cmd, static_dir,
				 created_at, updated_at)
			SELECT $1, $2, $3, $4, service_type, source_type, source_url, image_name,
				 build_command, start_command, type, 'stopped', image, command, $5,
				 git_repo, git_branch, build_path, cpu, memory, replicas, port, domain,
				 healthcheck_path, restart_policy, $6::jsonb, $7, $8,
				 builder, cpu_reserve, memory_reserve, static_build_cmd, static_dir,
				 $9, $9
			FROM services WHERE id = $10`,
		newID, targetProjectID, name, environmentID, environment, volumesJSON,
		maintenance, basicAuth, now, sourceID,
	)
	if err != nil {
		return uuid.Nil, err
	}

	if _, err := db.Exec(
		`INSERT INTO service_domains (service_id, domain, is_default, cert_type)
		 SELECT $1, domain, is_default, cert_type FROM service_domains WHERE service_id = $2`,
		newID, sourceID,
	); err != nil {
		_, _ = db.Exec(`DELETE FROM services WHERE id = $1`, newID)
		return uuid.Nil, err
	}
	// Variable values are copied as stored — ciphertext stays ciphertext.
	if _, err := db.Exec(
		`INSERT INTO environment_variables (id, service_id, key, value, is_secret)
		 SELECT gen_random_uuid(), $1, key, value, is_secret FROM environment_variables WHERE service_id = $2`,
		newID, sourceID,
	); err != nil {
		_, _ = db.Exec(`DELETE FROM services WHERE id = $1`, newID)
		return uuid.Nil, err
	}
	return newID, nil
}

type MoveServiceRequest struct {
	ProjectID uuid.UUID `json:"project_id" binding:"required"`
}

// handleMoveService re-parents a service to another project owned by the
// caller. Variables, domains, and volumes follow via the service id;
// running containers keep running (they join the new project's network on
// the next deploy).
func handleMoveService(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	userID, _ := c.Get("user_id")
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service ID", "code": "VALIDATION"})
		return
	}

	var req MoveServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}

	service, ok := loadOwnedService(c, db.(*database.DB))
	if !ok {
		return
	}
	if req.ProjectID == service.ProjectID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Service is already in that project", "code": "VALIDATION"})
		return
	}
	if !ownsProject(db.(*database.DB), req.ProjectID, userID.(string), contextIsAdmin(c)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to target project", "code": "FORBIDDEN"})
		return
	}

	var count int
	_ = db.(*database.DB).QueryRow(
		`SELECT COUNT(*) FROM services WHERE project_id = $1 AND name = $2`,
		req.ProjectID, service.Name,
	).Scan(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "A service with this name already exists in the target project", "code": "CONFLICT"})
		return
	}

	envName := service.Environment
	if envName == "" {
		envName = "production"
	}
	environmentID, err := getProjectEnvironmentID(db.(*database.DB), req.ProjectID, envName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve target environment"})
		return
	}

	res, err := db.(*database.DB).Exec(
		`UPDATE services SET project_id = $1, environment_id = $2, updated_at = $3 WHERE id = $4`,
		req.ProjectID, environmentID, time.Now(), serviceID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to move service"})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found", "code": "NOT_FOUND"})
		return
	}

	LogAuditWithRequest(c, "service", serviceID.String(), "service.move", map[string]interface{}{"to_project": req.ProjectID.String()})
	c.JSON(http.StatusOK, gin.H{"message": "Service moved", "project_id": req.ProjectID})
}

// ownsProject is true when the user owns the project or is an admin.
func ownsProject(db *database.DB, projectID uuid.UUID, userID string, isAdmin bool) bool {
	if isAdmin {
		return true
	}
	var owner string
	err := db.QueryRow(`SELECT owner_id FROM projects WHERE id = $1`, projectID).Scan(&owner)
	return err == nil && owner == userID
}

// loadServiceVolumesJSON returns the raw stored mounts for a verbatim copy.
func loadServiceVolumesJSON(db *database.DB, serviceID uuid.UUID) []byte {
	var raw []byte
	if err := db.QueryRow(`SELECT volumes FROM services WHERE id = $1`, serviceID).Scan(&raw); err != nil || len(raw) == 0 {
		return []byte("[]")
	}
	return raw
}
