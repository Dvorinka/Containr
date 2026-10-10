package api

import (
	"context"
	"net/http"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/secrets"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Project-level shared variables — referenced from service env values as
// ${{shared.KEY}} and resolved at runtime in resolveServiceEnv.

type ProjectVariable struct {
	ID        uuid.UUID `json:"id" db:"id"`
	ProjectID uuid.UUID `json:"project_id" db:"project_id"`
	Key       string    `json:"key" db:"key"`
	Value     string    `json:"value" db:"value"`
	IsSecret  bool      `json:"is_secret" db:"is_secret"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

func handleGetProjectVariables(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	if _, allowed := projectManageAccess(c, db.(*database.DB), projectID); !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	rows, err := db.(*database.DB).Query(
		`SELECT id, project_id, key, value, is_secret, created_at, updated_at
		 FROM project_variables WHERE project_id = $1 ORDER BY key ASC`,
		projectID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve variables"})
		return
	}
	defer rows.Close()

	variables := []ProjectVariable{}
	for rows.Next() {
		var v ProjectVariable
		if err := rows.Scan(&v.ID, &v.ProjectID, &v.Key, &v.Value, &v.IsSecret, &v.CreatedAt, &v.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan variable"})
			return
		}
		if v.IsSecret {
			v.Value = maskedSecretValue
		}
		variables = append(variables, v)
	}
	c.JSON(http.StatusOK, gin.H{"variables": variables})
}

func handleUpdateProjectVariables(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	if _, allowed := projectManageAccess(c, db.(*database.DB), projectID); !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var req UpdateVariablesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	storedSecrets := map[string]string{}
	secretRows, err := db.(*database.DB).Query(
		`SELECT key, value FROM project_variables WHERE project_id = $1 AND is_secret = TRUE`,
		projectID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load existing variables"})
		return
	}
	for secretRows.Next() {
		var k, v string
		if err := secretRows.Scan(&k, &v); err == nil {
			storedSecrets[k] = v
		}
	}
	secretRows.Close()

	tx, err := db.(*database.DB).Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to begin transaction"})
		return
	}
	defer tx.Rollback()

	txq := sqlcdb.New(tx)
	if err = txq.DeleteProjectVariables(c.Request.Context(), projectID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear existing variables"})
		return
	}
	now := time.Now()
	for _, v := range req.Variables {
		value := v.Value
		if v.IsSecret && value == maskedSecretValue {
			if stored, ok := storedSecrets[v.Key]; ok {
				value = stored
			}
		}
		if v.IsSecret {
			value = secrets.Encrypt(value)
		}
		if err = txq.InsertProjectVariable(c.Request.Context(), sqlcdb.InsertProjectVariableParams{
			ID:        uuid.New(),
			ProjectID: projectID,
			Key:       v.Key,
			Value:     value,
			IsSecret:  v.IsSecret,
			CreatedAt: now,
			UpdatedAt: now,
		}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert variable: " + v.Key})
			return
		}
	}
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	rows, err := db.(*database.DB).Query(
		`SELECT id, project_id, key, value, is_secret, created_at, updated_at
		 FROM project_variables WHERE project_id = $1 ORDER BY key ASC`,
		projectID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve variables"})
		return
	}
	defer rows.Close()

	variables := []ProjectVariable{}
	for rows.Next() {
		var v ProjectVariable
		if err := rows.Scan(&v.ID, &v.ProjectID, &v.Key, &v.Value, &v.IsSecret, &v.CreatedAt, &v.UpdatedAt); err != nil {
			continue
		}
		if v.IsSecret {
			v.Value = maskedSecretValue
		}
		variables = append(variables, v)
	}
	c.JSON(http.StatusOK, gin.H{"variables": variables, "message": "Project variables updated successfully"})
}

// resolveSharedVar returns the decrypted value of a project variable.
func resolveSharedVar(db *database.DB, projectID uuid.UUID, key string) (string, bool) {
	value, err := sqlcdb.New(db.DB).GetProjectVariableValue(context.Background(), sqlcdb.GetProjectVariableValueParams{
		ProjectID: projectID,
		Key:       key,
	})
	if err != nil {
		return "", false
	}
	return secrets.Decrypt(value), true
}
