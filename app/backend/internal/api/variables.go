package api

import (
	"containr/internal/database"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

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

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var ownerCheck string
	err = db.(*database.DB).QueryRow(
		`SELECT p.owner_id FROM services s 
		 JOIN projects p ON s.project_id = p.id 
		 WHERE s.id = $1`,
		serviceID,
	).Scan(&ownerCheck)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

	if ownerCheck != userID.(string) {
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
			v.Value = "********"
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

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var ownerCheck string
	err = db.(*database.DB).QueryRow(
		`SELECT p.owner_id FROM services s 
		 JOIN projects p ON s.project_id = p.id 
		 WHERE s.id = $1`,
		serviceID,
	).Scan(&ownerCheck)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

	if ownerCheck != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

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
		varID := uuid.New()
		_, err = tx.Exec(
			`INSERT INTO environment_variables (id, service_id, key, value, is_secret, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			varID, serviceID, v.Key, v.Value, v.IsSecret, now, now,
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
			v.Value = "********"
		}
		variables = append(variables, v)
	}

	c.JSON(http.StatusOK, gin.H{"variables": variables, "message": "Environment variables updated successfully"})
}
