package api

import (
	"net/http"
	"time"

	"containr/internal/database"
	"containr/internal/deployqueue"

	"github.com/gin-gonic/gin"
)

// GET /operations — a single cross-cutting view of platform work: active
// and recent deployments, the per-service deploy queue, recent cron runs,
// and recent backups. Scoped to the caller's projects (admins see all).

type operationDeployment struct {
	ID          string     `json:"id"`
	ServiceID   string     `json:"service_id"`
	ServiceName string     `json:"service_name"`
	ProjectName string     `json:"project_name"`
	Status      string     `json:"status"`
	Image       string     `json:"image"`
	Error       *string    `json:"error,omitempty"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type operationCronRun struct {
	ID         string     `json:"id"`
	JobName    string     `json:"job_name"`
	Schedule   string     `json:"schedule"`
	Status     string     `json:"status"`
	StartedAt  time.Time  `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	Error      *string    `json:"error,omitempty"`
}

type operationBackup struct {
	ID         string     `json:"id"`
	DatabaseID string     `json:"database_id"`
	DBName     string     `json:"database_name"`
	Status     string     `json:"status"`
	Size       string     `json:"size"`
	CreatedAt  time.Time  `json:"created_at"`
	Completed  *time.Time `json:"completed_at,omitempty"`
}

func handleGetOperations(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	db := c.MustGet("db").(*database.DB)
	isAdmin := contextIsAdmin(c)

	// Same visibility rule as the deployment list endpoint.
	visibility := `p.is_approved OR p.owner_id = $1 OR $2::bool
	    OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1)`

	active := []operationDeployment{}
	rows, err := db.Query(
		`SELECT d.id, d.service_id, s.name, p.name, d.status,
		        COALESCE(d.image_name, ''), d.error, d.started_at, d.completed_at, d.created_at
		 FROM deployments d
		 JOIN services s ON s.id = d.service_id
		 JOIN projects p ON p.id = s.project_id
		 WHERE d.status IN ('queued','pending','building','deploying','rolling_back')
		   AND (`+visibility+`)
		 ORDER BY d.created_at ASC`, userID, isAdmin)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var d operationDeployment
			var sid string
			_ = rows.Scan(&d.ID, &sid, &d.ServiceName, &d.ProjectName, &d.Status, &d.Image, &d.Error, &d.StartedAt, &d.CompletedAt, &d.CreatedAt)
			d.ServiceID = sid
			active = append(active, d)
		}
	}

	recentFailed := []operationDeployment{}
	rows2, err2 := db.Query(
		`SELECT d.id, d.service_id, s.name, p.name, d.status,
		        COALESCE(d.image_name, ''), d.error, d.started_at, d.completed_at, d.created_at
		 FROM deployments d
		 JOIN services s ON s.id = d.service_id
		 JOIN projects p ON p.id = s.project_id
		 WHERE d.status IN ('failed','cancelled','rolled_back')
		   AND d.updated_at > NOW() - INTERVAL '24 hours'
		   AND (`+visibility+`)
		 ORDER BY d.updated_at DESC
		 LIMIT 20`, userID, isAdmin)
	if err2 == nil {
		defer rows2.Close()
		for rows2.Next() {
			var d operationDeployment
			var sid string
			_ = rows2.Scan(&d.ID, &sid, &d.ServiceName, &d.ProjectName, &d.Status, &d.Image, &d.Error, &d.StartedAt, &d.CompletedAt, &d.CreatedAt)
			d.ServiceID = sid
			recentFailed = append(recentFailed, d)
		}
	}

	cronRuns := []operationCronRun{}
	rows3, err3 := db.Query(
		`SELECT e.id, j.name, j.schedule, e.status, e.started_at, e.finished_at, e.error
		 FROM cron_executions e
		 JOIN cron_jobs j ON j.id = e.cron_job_id
		 JOIN projects p ON p.id = j.project_id
		 WHERE e.started_at > NOW() - INTERVAL '24 hours'
		   AND (`+visibility+`)
		 ORDER BY e.started_at DESC
		 LIMIT 30`, userID, isAdmin)
	if err3 == nil {
		defer rows3.Close()
		for rows3.Next() {
			var r operationCronRun
			_ = rows3.Scan(&r.ID, &r.JobName, &r.Schedule, &r.Status, &r.StartedAt, &r.FinishedAt, &r.Error)
			cronRuns = append(cronRuns, r)
		}
	}

	backups := []operationBackup{}
	rows4, err4 := db.Query(
		`SELECT b.id, b.database_id, ds.name, b.status, b.size, b.created_at, b.completed_at
		 FROM database_backups b
		 JOIN database_services ds ON ds.id = b.database_id
		 WHERE b.created_at > NOW() - INTERVAL '24 hours'
		   AND (ds.user_id = $1 OR $2::bool)
		 ORDER BY b.created_at DESC
		 LIMIT 20`, userID, isAdmin)
	if err4 == nil {
		defer rows4.Close()
		for rows4.Next() {
			var b operationBackup
			_ = rows4.Scan(&b.ID, &b.DatabaseID, &b.DBName, &b.Status, &b.Size, &b.CreatedAt, &b.Completed)
			backups = append(backups, b)
		}
	}

	var queue []deployqueue.ServiceQueueState
	if queueValue, exists := c.Get("deploy_queue"); exists && queueValue != nil {
		queue = queueValue.(*deployqueue.Queue).Snapshot()
	}
	if queue == nil {
		queue = []deployqueue.ServiceQueueState{}
	}

	c.JSON(http.StatusOK, gin.H{
		"active_deployments": active,
		"recent_failures":    recentFailed,
		"cron_runs":          cronRuns,
		"backups":            backups,
		"deploy_queue":       queue,
	})
}
