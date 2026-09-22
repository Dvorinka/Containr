package api

import (
	"containr/internal/database"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// maskedSecretValue is the placeholder returned for secret values; on update
// it means "keep the stored value" rather than overwriting with asterisks.
const maskedSecretValue = "********"

type EnvironmentVariable struct {
	ID        uuid.UUID `json:"id" db:"id"`
	ServiceID uuid.UUID `json:"service_id" db:"service_id"`
	Key       string    `json:"key" db:"key"`
	Value     string    `json:"value" db:"value"`
	IsSecret  bool      `json:"is_secret" db:"is_secret"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type UpdateVariablesRequest struct {
	Variables []VariableInput `json:"variables" binding:"required"`
}

type VariableInput struct {
	Key      string `json:"key" binding:"required"`
	Value    string `json:"value"`
	IsSecret bool   `json:"is_secret"`
}

func handleGetVariables(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	serviceIDStr := c.Param("id")
	serviceID, err := uuid.Parse(serviceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service ID"})
		return
	}

	projectID, found := serviceProjectID(db.(*database.DB), serviceID)
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}
	if _, allowed := projectManageAccess(c, db.(*database.DB), projectID); !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	rows, err := db.(*database.DB).Query(
		`SELECT id, service_id, key, value, is_secret, created_at, updated_at
		 FROM environment_variables 
		 WHERE service_id = $1 
		 ORDER BY key ASC`,
		serviceID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve variables"})
		return
	}
	defer rows.Close()

	var variables []EnvironmentVariable
	for rows.Next() {
		var v EnvironmentVariable
		err := rows.Scan(
			&v.ID, &v.ServiceID, &v.Key, &v.Value, &v.IsSecret, &v.CreatedAt, &v.UpdatedAt,
		)
		if err != nil {
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

func handleUpdateVariables(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not available"})
		return
	}

	serviceIDStr := c.Param("id")
	serviceID, err := uuid.Parse(serviceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service ID"})
		return
	}

	var req UpdateVariablesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	projectID, found := serviceProjectID(db.(*database.DB), serviceID)
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}
	if _, allowed := projectManageAccess(c, db.(*database.DB), projectID); !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Snapshot stored secrets so a client echoing back the masked placeholder
	// does not destroy the real value.
	storedSecrets := map[string]string{}
	secretRows, err := db.(*database.DB).Query(
		`SELECT key, value FROM environment_variables WHERE service_id = $1 AND is_secret = TRUE`,
		serviceID,
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

	_, err = tx.Exec("DELETE FROM environment_variables WHERE service_id = $1", serviceID)
	if err != nil {
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
		varID := uuid.New()
		_, err = tx.Exec(
			`INSERT INTO environment_variables (id, service_id, key, value, is_secret, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			varID, serviceID, v.Key, value, v.IsSecret, now, now,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert variable: " + v.Key})
			return
		}
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	rows, err := db.(*database.DB).Query(
		`SELECT id, service_id, key, value, is_secret, created_at, updated_at
		 FROM environment_variables 
		 WHERE service_id = $1 
		 ORDER BY key ASC`,
		serviceID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve variables"})
		return
	}
	defer rows.Close()

	var variables []EnvironmentVariable
	for rows.Next() {
		var v EnvironmentVariable
		err := rows.Scan(
			&v.ID, &v.ServiceID, &v.Key, &v.Value, &v.IsSecret, &v.CreatedAt, &v.UpdatedAt,
		)
		if err != nil {
			continue
		}
		if v.IsSecret {
			v.Value = maskedSecretValue
		}
		variables = append(variables, v)
	}

	c.JSON(http.StatusOK, gin.H{"variables": variables, "message": "Environment variables updated successfully"})
}
