package api

import (
	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/docker"
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
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

// cronJobFrom maps the sqlc row onto the string-ID API model.
func cronJobFrom(j sqlcdb.CronJob) CronJob {
	return CronJob{
		ID:         j.ID.String(),
		ProjectID:  j.ProjectID.String(),
		ServiceID:  j.ServiceID.String(),
		Name:       j.Name,
		Schedule:   j.Schedule,
		Command:    j.Command,
		Timezone:   j.Timezone.String,
		Enabled:    j.Enabled.Bool,
		LastRunAt:  timePtrNT(j.LastRunAt),
		NextRunAt:  timePtrNT(j.NextRunAt),
		LastStatus: j.LastStatus.String,
		LastOutput: j.LastOutput.String,
		Retention:  int(j.Retention.Int32),
		CreatedAt:  j.CreatedAt.Time,
		UpdatedAt:  j.UpdatedAt.Time,
	}
}

// cronExecutionFrom maps the sqlc row onto the string-ID API model.
func cronExecutionFrom(e sqlcdb.CronExecution) CronExecution {
	return CronExecution{
		ID:         e.ID.String(),
		CronJobID:  e.CronJobID.String(),
		StartedAt:  e.StartedAt,
		FinishedAt: timePtrNT(e.FinishedAt),
		Status:     e.Status.String,
		Output:     e.Output.String,
		Error:      e.Error.String,
	}
}

// cronJobProjectID resolves the project a cron job belongs to.
func cronJobProjectID(db *database.DB, jobID string) (uuid.UUID, bool) {
	id, err := uuid.Parse(jobID)
	if err != nil {
		return uuid.Nil, false
	}
	projectID, err := sqlcdb.New(db.DB).GetCronJobProjectID(context.Background(), id)
	if err != nil {
		return uuid.Nil, false
	}
	return projectID, true
}

func handleGetCronJobs(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	userID := optionalUserUUID(c)
	isAdmin := contextIsAdmin(c)
	projectID := c.Query("project_id")
	serviceID := c.Query("service_id")

	query := `SELECT cj.id, cj.project_id, cj.service_id, cj.name, cj.schedule, cj.timezone,
	          cj.enabled, cj.last_run_at, cj.next_run_at, cj.last_status, cj.last_output,
	          cj.retention, cj.created_at, cj.updated_at
	          FROM cron_jobs cj
	          JOIN projects p ON cj.project_id = p.id
	          WHERE (p.is_approved OR p.owner_id = $1 OR $2::bool
	              OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1))`
	args := []interface{}{userID, isAdmin}

	if projectID != "" {
		args = append(args, projectID)
		query += fmt.Sprintf(" AND cj.project_id = $%d", len(args))
	}
	if serviceID != "" {
		args = append(args, serviceID)
		query += fmt.Sprintf(" AND cj.service_id = $%d", len(args))
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

	svcID, err := uuid.Parse(req.ServiceID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	ownerCheck, err := sqlcdb.New(db.DB).GetCronOwnerViaService(context.Background(), svcID)

	if err != nil || (ownerCheck.String() != userID && !contextIsAdmin(c)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if req.Timezone == "" {
		req.Timezone = "UTC"
	}
	if req.Retention == 0 {
		req.Retention = 30
	}

	nextRun, err := calculateNextRun(req.Schedule, req.Timezone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid schedule: %v", err)})
		return
	}

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

	err = sqlcdb.New(db.DB).InsertCronJob(context.Background(), sqlcdb.InsertCronJobParams{
		ID:        uuid.MustParse(job.ID),
		ProjectID: uuid.MustParse(job.ProjectID),
		ServiceID: uuid.MustParse(job.ServiceID),
		Name:      job.Name,
		Schedule:  job.Schedule,
		Command:   job.Command,
		Timezone:  sql.NullString{String: job.Timezone, Valid: true},
		Enabled:   sql.NullBool{Bool: job.Enabled, Valid: true},
		NextRunAt: ntPtr(job.NextRunAt),
		Retention: sql.NullInt32{Int32: int32(job.Retention), Valid: true},
		CreatedAt: sql.NullTime{Time: job.CreatedAt, Valid: true},
		UpdatedAt: sql.NullTime{Time: job.UpdatedAt, Valid: true},
	})

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
	jobID := c.Param("id")

	jid, err := uuid.Parse(jobID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cron job not found"})
		return
	}
	row, err := sqlcdb.New(db.DB).GetCronJob(context.Background(), jid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cron job not found"})
		return
	}
	job := cronJobFrom(row)

	projectID, found := cronJobProjectID(db, jobID)
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cron job not found"})
		return
	}
	if _, allowed := projectReadAccess(c, db, projectID); !allowed {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cron job not found"})
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

	jid, err := uuid.Parse(jobID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	ownerCheck, err := sqlcdb.New(db.DB).GetCronJobOwner(context.Background(), jid)

	if err != nil || (ownerCheck.String() != userID && !contextIsAdmin(c)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Schedule != "" {
		next, err := calculateNextRun(req.Schedule, req.Timezone)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid schedule: %v", err)})
			return
		}
		updates["schedule"] = req.Schedule
		updates["next_run_at"] = next
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

	jid, err := uuid.Parse(jobID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	ownerCheck, err := sqlcdb.New(db.DB).GetCronJobOwner(context.Background(), jid)

	if err != nil || (ownerCheck.String() != userID && !contextIsAdmin(c)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if err := sqlcdb.New(db.DB).DeleteCronJob(context.Background(), jid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete cron job"})
		return
	}

	LogAudit(userID, "cron_job", jobID, "delete", nil)

	c.JSON(http.StatusOK, gin.H{"message": "Cron job deleted successfully"})
}

func handleGetCronExecutions(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	jobID := c.Param("id")

	projectID, found := cronJobProjectID(db, jobID)
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cron job not found"})
		return
	}
	if _, allowed := projectReadAccess(c, db, projectID); !allowed {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cron job not found"})
		return
	}

	jid, err := uuid.Parse(jobID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch executions"})
		return
	}
	rows, err := sqlcdb.New(db.DB).ListCronExecutions(context.Background(), jid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch executions"})
		return
	}

	var executions []CronExecution
	for _, e := range rows {
		executions = append(executions, cronExecutionFrom(e))
	}

	c.JSON(http.StatusOK, gin.H{"executions": executions})
}

func handleTriggerCronJob(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	db := c.MustGet("db").(*database.DB)
	jobID := c.Param("id")

	jid, err := uuid.Parse(jobID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	trig, err := sqlcdb.New(db.DB).GetCronJobForTrigger(context.Background(), jid)
	if err != nil || (trig.OwnerID.String() != userID && !contextIsAdmin(c)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	job := CronJob{
		ServiceID: trig.ServiceID.String(),
		Command:   trig.Command,
		Schedule:  trig.Schedule,
		Timezone:  trig.Timezone.String,
		Retention: int(trig.Retention.Int32),
	}

	execID := uuid.New().String()
	now := time.Now()

	_ = sqlcdb.New(db.DB).InsertCronExecution(context.Background(), sqlcdb.InsertCronExecutionParams{
		ID:        uuid.MustParse(execID),
		CronJobID: jid,
		StartedAt: now,
		Status:    sql.NullString{String: "running", Valid: true},
	})

	dockerClient, _ := c.Get("docker_client")
	dockerCli, _ := dockerClient.(*docker.Client)
	go executeCronJob(db, dockerCli, jobID, job.ServiceID, execID, job.Command, job.Schedule, job.Timezone, job.Retention)

	LogAudit(userID, "cron_job", jobID, "trigger", map[string]interface{}{
		"execution_id": execID,
	})

	c.JSON(http.StatusOK, gin.H{
		"message":      "Cron job triggered",
		"execution_id": execID,
	})
}

// cronScheduleParser parses standard 5-field cron expressions plus
// descriptors (@daily etc.) and CRON_TZ= prefixes.
var cronScheduleParser = cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor)

func calculateNextRun(schedule, timezone string) (*time.Time, error) {
	expr := strings.TrimSpace(schedule)
	if tz := strings.TrimSpace(timezone); tz != "" && tz != "UTC" {
		expr = "CRON_TZ=" + tz + " " + expr
	}
	parsed, err := cronScheduleParser.Parse(expr)
	if err != nil {
		return nil, err
	}
	next := parsed.Next(time.Now())
	return &next, nil
}

// StartCronScheduler ticks every minute and executes enabled cron jobs whose
// next_run_at is due. Each run is recorded in cron_executions and output is
// captured from docker exec inside the service's container.
func StartCronScheduler(ctx context.Context, db *database.DB, dockerClient *docker.Client) {
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				runDueCronJobs(db, dockerClient)
				runDueDatabaseBackups(db, dockerClient)
			}
		}
	}()
}

func runDueCronJobs(db *database.DB, dockerClient *docker.Client) {
	q := sqlcdb.New(db.DB)
	jobs, err := q.ListDueCronJobs(context.Background())
	if err != nil {
		log.Printf("cron scheduler: failed to list due jobs: %v", err)
		return
	}

	for _, j := range jobs {
		execID := uuid.New().String()
		if err := q.InsertCronExecution(context.Background(), sqlcdb.InsertCronExecutionParams{
			ID:        uuid.MustParse(execID),
			CronJobID: j.ID,
			StartedAt: time.Now(),
			Status:    sql.NullString{String: "running", Valid: true},
		}); err != nil {
			log.Printf("cron scheduler: failed to record execution for %s: %v", j.ID, err)
			continue
		}
		go executeCronJob(db, dockerClient, j.ID.String(), j.ServiceID.String(), execID, j.Command, j.Schedule, j.Timezone.String, int(j.Retention.Int32))
	}
}

// runDueDatabaseBackups snapshots managed databases whose backup_schedule is
// due, reusing the same archive pipeline as manual backups.
func runDueDatabaseBackups(db *database.DB, dockerClient *docker.Client) {
	if dockerClient == nil {
		return
	}
	q := sqlcdb.New(db.DB)
	due, err := q.ListDueDatabaseBackups(context.Background())
	if err != nil {
		log.Printf("cron scheduler: failed to list due database backups: %v", err)
		return
	}
	handler := NewDatabaseHandler(db.DB, dockerClient)
	for _, row := range due {
		schedule := row.BackupSchedule.String
		next, err := calculateNextRun(schedule, "UTC")
		if err != nil {
			log.Printf("cron scheduler: invalid backup schedule %q on %s: %v", schedule, row.ID, err)
			continue
		}
		now := time.Now()
		if err := q.SetDatabaseNextBackupAt(context.Background(), sqlcdb.SetDatabaseNextBackupAtParams{
			NextBackupAt: sql.NullTime{Time: *next, Valid: true},
			ID:           row.ID,
		}); err != nil {
			log.Printf("cron scheduler: failed to advance backup schedule on %s: %v", row.ID, err)
			continue
		}
		backupID := generateDatabaseBackupID(row.ID)
		archivePath := sanitizeBackupArchivePath(managedDatabaseBackupArchivePath(backupID))
		if err := q.CreateDatabaseBackup(context.Background(), sqlcdb.CreateDatabaseBackupParams{
			ID:         backupID,
			DatabaseID: row.ID,
			Size:       "pending",
			Status:     "in_progress",
			BackupPath: sql.NullString{String: archivePath, Valid: true},
			CreatedAt:  sql.NullTime{Time: now, Valid: true},
		}); err != nil {
			log.Printf("cron scheduler: failed to record backup for %s: %v", row.ID, err)
			continue
		}
		go handler.createBackupProcess(row.ID, backupID, archivePath)
	}
}

// findServiceContainer returns the first running container whose name matches
// the deployment naming convention containr-<serviceID>-*.
func findServiceContainer(ctx context.Context, dockerClient *docker.Client, serviceID string) (string, error) {
	containers, err := dockerClient.ListContainers(ctx, false)
	if err != nil {
		return "", err
	}
	prefix := "containr-" + serviceID + "-"
	for _, ctr := range containers {
		for _, name := range ctr.Names {
			if strings.HasPrefix(strings.TrimPrefix(name, "/"), prefix) {
				return ctr.ID, nil
			}
		}
	}
	return "", fmt.Errorf("no running container for service %s", serviceID)
}

func executeCronJob(db *database.DB, dockerClient *docker.Client, jobID, serviceID, execID, command, schedule, timezone string, retention int) {
	status := "success"
	var output, errText string

	if dockerClient == nil {
		status, errText = "failed", "docker unavailable"
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		containerID, findErr := findServiceContainer(ctx, dockerClient, serviceID)
		if findErr != nil {
			status, errText = "failed", findErr.Error()
		} else {
			out, exitCode, runErr := dockerClient.ExecRun(ctx, containerID, []string{"sh", "-c", command})
			output = out
			if len(output) > 64*1024 {
				output = output[:64*1024]
			}
			if runErr != nil {
				status, errText = "failed", runErr.Error()
			} else if exitCode != 0 {
				status, errText = "failed", fmt.Sprintf("exit code %d", exitCode)
			}
		}
	}

	now := time.Now()
	q := sqlcdb.New(db.DB)
	if eid, err := uuid.Parse(execID); err == nil {
		_ = q.FinishCronExecution(context.Background(), sqlcdb.FinishCronExecutionParams{
			FinishedAt: sql.NullTime{Time: now, Valid: true},
			Status:     sql.NullString{String: status, Valid: true},
			Output:     sql.NullString{String: output, Valid: true},
			Error:      sql.NullString{String: errText, Valid: true},
			ID:         eid,
		})
	}

	next, _ := calculateNextRun(schedule, timezone)
	if jid, err := uuid.Parse(jobID); err == nil {
		_ = q.UpdateCronJobRun(context.Background(), sqlcdb.UpdateCronJobRunParams{
			LastRunAt:  sql.NullTime{Time: now, Valid: true},
			LastStatus: sql.NullString{String: status, Valid: true},
			LastOutput: sql.NullString{String: output, Valid: true},
			NextRunAt:  ntPtr(next),
			ID:         jid,
		})

		if retention > 0 {
			_ = q.TrimCronExecutions(context.Background(), sqlcdb.TrimCronExecutionsParams{
				CronJobID: jid,
				Limit:     int32(retention),
			})
		}
	}
}
