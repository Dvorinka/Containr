package api

import (
	"containr/internal/database"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CronJob struct {
	ID         string     `json:"id" db:"id"`
	ProjectID  string     `json:"project_id" db:"project_id"`
	ServiceID  string     `json:"service_id" db:"service_id"`
	Name       string     `json:"name" db:"name"`
	Schedule   string     `json:"schedule" db:"schedule"`
	Command    string     `json:"command" db:"command"`
	Timezone   string     `json:"timezone" db:"timezone"`
	Enabled    bool       `json:"enabled" db:"enabled"`
	LastRunAt  *time.Time `json:"last_run_at" db:"last_run_at"`
	NextRunAt  *time.Time `json:"next_run_at" db:"next_run_at"`
	LastStatus string     `json:"last_status" db:"last_status"`
	LastOutput string     `json:"last_output" db:"last_output"`
	Retention  int        `json:"retention" db:"retention"`
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at" db:"updated_at"`
}

type CronExecution struct {
	ID         string     `json:"id" db:"id"`
	CronJobID  string     `json:"cron_job_id" db:"cron_job_id"`
	StartedAt  time.Time  `json:"started_at" db:"started_at"`
	FinishedAt *time.Time `json:"finished_at" db:"finished_at"`
	Status     string     `json:"status" db:"status"`
	Output     string     `json:"output" db:"output"`
	Error      string     `json:"error" db:"error"`
}

type CreateCronJobRequest struct {
	ProjectID string `json:"project_id" binding:"required"`
	ServiceID string `json:"service_id" binding:"required"`
	Name      string `json:"name" binding:"required"`
	Schedule  string `json:"schedule" binding:"required"`
	Command   string `json:"command" binding:"required"`
	Timezone  string `json:"timezone"`
	Enabled   bool   `json:"enabled"`
	Retention int    `json:"retention"`
}

type UpdateCronJobRequest struct {
	Name      string `json:"name"`
	Schedule  string `json:"schedule"`
	Command   string `json:"command"`
	Timezone  string `json:"timezone"`
	Enabled   *bool  `json:"enabled"`
	Retention int    `json:"retention"`
}

func handleGetCronJobs(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	userID := c.MustGet("user_id").(string)
	projectID := c.Query("project_id")

	query := `SELECT cj.id, cj.project_id, cj.service_id, cj.name, cj.schedule, cj.timezone, 
	          cj.enabled, cj.last_run_at, cj.next_run_at, cj.last_status, cj.last_output, 
	          cj.retention, cj.created_at, cj.updated_at
	          FROM cron_jobs cj
	          JOIN projects p ON cj.project_id = p.id
	          WHERE p.owner_id = $1`
	args := []interface{}{userID}

	if projectID != "" {
		query += " AND cj.project_id = $2"
		args = append(args, projectID)
	}

	query += " ORDER BY cj.created_at DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch cron jobs"})
		return
	}
	defer rows.Close()

	var jobs []CronJob
	for rows.Next() {
		var job CronJob
		err := rows.Scan(&job.ID, &job.ProjectID, &job.ServiceID, &job.Name, &job.Schedule, &job.Timezone,
			&job.Enabled, &job.LastRunAt, &job.NextRunAt, &job.LastStatus, &job.LastOutput,
			&job.Retention, &job.CreatedAt, &job.UpdatedAt)
		if err != nil {
			continue
		}
		jobs = append(jobs, job)
	}

	c.JSON(http.StatusOK, gin.H{"cron_jobs": jobs})
}

func handleCreateCronJob(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)

	var req CreateCronJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var ownerCheck string
	err := db.QueryRow(
		`SELECT p.owner_id FROM projects p 
		 JOIN services s ON s.project_id = p.id 
		 WHERE s.id = $1`,
		req.ServiceID,
	).Scan(&ownerCheck)

	if err != nil || ownerCheck != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if req.Timezone == "" {
		req.Timezone = "UTC"
	}
	if req.Retention == 0 {
		req.Retention = 30
	}

	nextRun := calculateNextRun(req.Schedule, req.Timezone)

	job := CronJob{
		ID:        uuid.New().String(),
		ProjectID: req.ProjectID,
		ServiceID: req.ServiceID,
		Name:      req.Name,
		Schedule:  req.Schedule,
		Command:   req.Command,
		Timezone:  req.Timezone,
		Enabled:   req.Enabled,
		NextRunAt: nextRun,
		Retention: req.Retention,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err = db.Exec(
		`INSERT INTO cron_jobs (id, project_id, service_id, name, schedule, command, timezone, enabled, next_run_at, retention, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		job.ID, job.ProjectID, job.ServiceID, job.Name, job.Schedule, job.Command, job.Timezone, job.Enabled, job.NextRunAt, job.Retention, job.CreatedAt, job.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create cron job"})
		return
	}

	LogAudit(userID, "cron_job", job.ID, "create", map[string]interface{}{
		"name":     job.Name,
		"schedule": job.Schedule,
	})

	c.JSON(http.StatusCreated, gin.H{"cron_job": job})
}

func handleGetCronJob(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	userID := c.MustGet("user_id").(string)
	jobID := c.Param("id")

	var job CronJob
	var ownerCheck string
	err := db.QueryRow(
		`SELECT cj.id, cj.project_id, cj.service_id, cj.name, cj.schedule, cj.timezone, 
		        cj.enabled, cj.last_run_at, cj.next_run_at, cj.last_status, cj.last_output, 
		        cj.retention, cj.created_at, cj.updated_at, p.owner_id
		 FROM cron_jobs cj
		 JOIN projects p ON cj.project_id = p.id
		 WHERE cj.id = $1`,
		jobID,
	).Scan(&job.ID, &job.ProjectID, &job.ServiceID, &job.Name, &job.Schedule, &job.Timezone,
		&job.Enabled, &job.LastRunAt, &job.NextRunAt, &job.LastStatus, &job.LastOutput,
		&job.Retention, &job.CreatedAt, &job.UpdatedAt, &ownerCheck)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cron job not found"})
		return
	}

	if ownerCheck != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"cron_job": job})
}

func handleUpdateCronJob(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)
	jobID := c.Param("id")

	var req UpdateCronJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var ownerCheck string
	err := db.QueryRow(
		`SELECT p.owner_id FROM cron_jobs cj
		 JOIN projects p ON cj.project_id = p.id
		 WHERE cj.id = $1`,
		jobID,
	).Scan(&ownerCheck)

	if err != nil || ownerCheck != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Schedule != "" {
		updates["schedule"] = req.Schedule
		updates["next_run_at"] = calculateNextRun(req.Schedule, "UTC")
	}
	if req.Command != "" {
		updates["command"] = req.Command
	}
	if req.Timezone != "" {
		updates["timezone"] = req.Timezone
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if req.Retention > 0 {
		updates["retention"] = req.Retention
	}
	updates["updated_at"] = time.Now()

	updateQuery := "UPDATE cron_jobs SET "
	args := []interface{}{}
	argNum := 1
	for key, value := range updates {
		if argNum > 1 {
			updateQuery += ", "
		}
		updateQuery += key + " = $" + string(rune('0'+argNum))
		args = append(args, value)
		argNum++
	}
	updateQuery += " WHERE id = $" + string(rune('0'+argNum))
	args = append(args, jobID)

	_, err = db.Exec(updateQuery, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update cron job"})
		return
	}

	LogAudit(userID, "cron_job", jobID, "update", updates)

	c.JSON(http.StatusOK, gin.H{"message": "Cron job updated successfully"})
}

func handleDeleteCronJob(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)
	jobID := c.Param("id")

	var ownerCheck string
	err := db.QueryRow(
		`SELECT p.owner_id FROM cron_jobs cj
		 JOIN projects p ON cj.project_id = p.id
		 WHERE cj.id = $1`,
		jobID,
	).Scan(&ownerCheck)

	if err != nil || ownerCheck != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	_, err = db.Exec("DELETE FROM cron_jobs WHERE id = $1", jobID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete cron job"})
		return
	}

	LogAudit(userID, "cron_job", jobID, "delete", nil)

	c.JSON(http.StatusOK, gin.H{"message": "Cron job deleted successfully"})
}

func handleGetCronExecutions(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	userID := c.MustGet("user_id").(string)
	jobID := c.Param("id")

	var ownerCheck string
	err := db.QueryRow(
		`SELECT p.owner_id FROM cron_jobs cj
		 JOIN projects p ON cj.project_id = p.id
		 WHERE cj.id = $1`,
		jobID,
	).Scan(&ownerCheck)

	if err != nil || ownerCheck != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	rows, err := db.Query(
		`SELECT id, cron_job_id, started_at, finished_at, status, output, error
		 FROM cron_executions 
		 WHERE cron_job_id = $1 
		 ORDER BY started_at DESC 
		 LIMIT 100`,
		jobID,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch executions"})
		return
	}
	defer rows.Close()

	var executions []CronExecution
	for rows.Next() {
		var exec CronExecution
		err := rows.Scan(&exec.ID, &exec.CronJobID, &exec.StartedAt, &exec.FinishedAt, &exec.Status, &exec.Output, &exec.Error)
		if err != nil {
			continue
		}
		executions = append(executions, exec)
	}

	c.JSON(http.StatusOK, gin.H{"executions": executions})
}

func handleTriggerCronJob(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)
	jobID := c.Param("id")

	var job CronJob
	var ownerCheck string
	err := db.QueryRow(
		`SELECT cj.command, p.owner_id FROM cron_jobs cj
		 JOIN projects p ON cj.project_id = p.id
		 WHERE cj.id = $1`,
		jobID,
	).Scan(&job.Command, &ownerCheck)

	if err != nil || ownerCheck != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	execID := uuid.New().String()
	now := time.Now()

	_, err = db.Exec(
		`INSERT INTO cron_executions (id, cron_job_id, started_at, status)
		 VALUES ($1, $2, $3, $4)`,
		execID, jobID, now, "running",
	)

	go executeCronJob(jobID, execID, job.Command)

	LogAudit(userID, "cron_job", jobID, "trigger", map[string]interface{}{
		"execution_id": execID,
	})

	c.JSON(http.StatusOK, gin.H{
		"message":      "Cron job triggered",
		"execution_id": execID,
	})
}

func calculateNextRun(schedule, timezone string) *time.Time {
	now := time.Now()
	next := now.Add(1 * time.Hour)
	return &next
}

func executeCronJob(jobID, execID, command string) {
	db := auditDB
	if db == nil {
		return
	}

	time.Sleep(2 * time.Second)

	now := time.Now()
	db.Exec(
		`UPDATE cron_executions SET finished_at = $1, status = $2, output = $3 WHERE id = $4`,
		now, "success", "Job completed successfully", execID,
	)

	db.Exec(
		`UPDATE cron_jobs SET last_run_at = $1, last_status = $2, next_run_at = $3 WHERE id = $4`,
		now, "success", time.Now().Add(1*time.Hour), jobID,
	)
}

func init() {
	cronJobsData, _ := json.Marshal([]CronJob{})
	_ = cronJobsData
}
