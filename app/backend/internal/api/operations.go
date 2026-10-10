package api

import (
	"context"
	"net/http"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/deployqueue"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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

	userUUID, _ := uuid.Parse(userID)
	q := sqlcdb.New(db.DB)
	visibility := sqlcdb.ListActiveOperationDeploymentsParams{OwnerID: userUUID, Column2: isAdmin}

	active := []operationDeployment{}
	if rows, err := q.ListActiveOperationDeployments(context.Background(), visibility); err == nil {
		for _, r := range rows {
			active = append(active, operationDeployment{
				ID: r.ID.String(), ServiceID: r.ServiceID.String(), ServiceName: r.ServiceName,
				ProjectName: r.ProjectName, Status: r.Status.String, Image: r.Image,
				Error: strPtrNS(r.Error), StartedAt: timePtrNT(r.StartedAt),
				CompletedAt: timePtrNT(r.CompletedAt), CreatedAt: r.CreatedAt.Time,
			})
		}
	}

	recentFailed := []operationDeployment{}
	if rows, err := q.ListRecentFailedDeployments(context.Background(), sqlcdb.ListRecentFailedDeploymentsParams{
		OwnerID: userUUID, Column2: isAdmin,
	}); err == nil {
		for _, r := range rows {
			recentFailed = append(recentFailed, operationDeployment{
				ID: r.ID.String(), ServiceID: r.ServiceID.String(), ServiceName: r.ServiceName,
				ProjectName: r.ProjectName, Status: r.Status.String, Image: r.Image,
				Error: strPtrNS(r.Error), StartedAt: timePtrNT(r.StartedAt),
				CompletedAt: timePtrNT(r.CompletedAt), CreatedAt: r.CreatedAt.Time,
			})
		}
	}

	cronRuns := []operationCronRun{}
	if rows, err := q.ListRecentCronRuns(context.Background(), sqlcdb.ListRecentCronRunsParams{
		OwnerID: userUUID, Column2: isAdmin,
	}); err == nil {
		for _, r := range rows {
			cronRuns = append(cronRuns, operationCronRun{
				ID: r.ID.String(), JobName: r.JobName, Schedule: r.Schedule, Status: r.Status.String,
				StartedAt: r.StartedAt, FinishedAt: timePtrNT(r.FinishedAt), Error: strPtrNS(r.Error),
			})
		}
	}

	backups := []operationBackup{}
	if rows, err := q.ListRecentOperationBackups(context.Background(), sqlcdb.ListRecentOperationBackupsParams{
		UserID: userID, Column2: isAdmin,
	}); err == nil {
		for _, r := range rows {
			backups = append(backups, operationBackup{
				ID: r.ID, DatabaseID: r.DatabaseID, DBName: r.DbName, Status: r.Status,
				Size: r.Size, CreatedAt: r.CreatedAt.Time, Completed: timePtrNT(r.CompletedAt),
			})
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
