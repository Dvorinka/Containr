package api

import (
	"context"
	"database/sql"
	"strings"
	"testing"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"

	"github.com/google/uuid"
)

func TestCalculateNextRun(t *testing.T) {
	cases := []struct {
		name     string
		schedule string
		timezone string
		wantErr  bool
	}{
		{"every minute", "* * * * *", "", false},
		{"daily at 4am", "0 4 * * *", "UTC", false},
		{"weekday run", "0 9 * * 1-5", "Europe/Prague", false},
		{"whitespace tolerated", "  */15 * * * *  ", "", false},
		{"empty schedule", "", "", true},
		{"bad field count", "* * *", "", true},
		{"garbage", "not a cron", "", true},
		{"bad timezone", "0 4 * * *", "Mars/Olympus", true},
	}
	now := time.Now()
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			next, err := calculateNextRun(tc.schedule, tc.timezone)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got next=%v", next)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if next == nil {
				t.Fatal("expected non-nil next run")
			}
			if !next.After(now) {
				t.Errorf("next run %v is not after %v", next, now)
			}
		})
	}
}

func TestCalculateNextRunTimezone(t *testing.T) {
	// CRON_TZ must change the computed instant: 04:00 in a fixed-offset zone
	// lands at a different UTC hour than 04:00 UTC.
	utcNext, err := calculateNextRun("0 4 * * *", "UTC")
	if err != nil {
		t.Fatalf("utc: %v", err)
	}
	tokyoNext, err := calculateNextRun("0 4 * * *", "Asia/Tokyo")
	if err != nil {
		t.Fatalf("tokyo: %v", err)
	}
	if utcNext.Equal(*tokyoNext) {
		t.Fatalf("timezone had no effect: both %v", utcNext)
	}
	if !strings.EqualFold(utcNext.Location().String(), "Local") {
		// UTC-scheduled runs still land in server-local time representation.
		t.Logf("utc next: %v / tokyo next: %v", utcNext, tokyoNext)
	}
}

// TestCronLiveInvariants exercises the cron.sql queries on live Postgres:
// insert/read/owner join, execution lifecycle, run bookkeeping, retention trim.
func TestCronLiveInvariants(t *testing.T) {
	dsn := testDSNString(t)
	db, err := database.NewConnection(dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer db.Close()
	ctx := context.Background()
	q := sqlcdb.New(db.DB)

	userID := uuid.New()
	projectID := uuid.New()
	envID := uuid.New()
	serviceID := uuid.New()
	jobID := uuid.New()
	suffix := strings.ReplaceAll(jobID.String()[:8], "-", "")
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatalf("setup: %v", err)
		}
	}
	_, err = db.Exec(`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, 'x', 'test')`,
		userID, "cron-"+suffix+"@test.local")
	must(err)
	_, err = db.Exec(`INSERT INTO projects (id, name, owner_id, is_approved) VALUES ($1, $2, $3, true)`,
		projectID, "cron-"+suffix, userID)
	must(err)
	_, err = db.Exec(`INSERT INTO environments (id, name, project_id) VALUES ($1, 'production', $2)`,
		envID, projectID)
	must(err)
	_, err = db.Exec(`INSERT INTO services (id, name, project_id, environment_id, service_type, source_type)
		VALUES ($1, $2, $3, $4, 'web', 'image')`,
		serviceID, "cron-"+suffix, projectID, envID)
	must(err)
	defer func() { _, _ = db.Exec(`DELETE FROM users WHERE id = $1`, userID) }()

	next, err := calculateNextRun("0 4 * * *", "UTC")
	if err != nil {
		t.Fatalf("schedule: %v", err)
	}
	must(q.InsertCronJob(ctx, sqlcdb.InsertCronJobParams{
		ID: jobID, ProjectID: projectID, ServiceID: serviceID,
		Name: "job-" + suffix, Schedule: "0 4 * * *", Command: "echo hi",
		Timezone:  sql.NullString{String: "UTC", Valid: true},
		Enabled:   sql.NullBool{Bool: true, Valid: true},
		NextRunAt: ntPtr(next),
	}))
	job, err := q.GetCronJob(ctx, jobID)
	if err != nil || job.Name != "job-"+suffix || job.Command != "echo hi" {
		t.Fatalf("job: %v %+v", err, job)
	}
	owner, err := q.GetCronJobOwner(ctx, jobID)
	if err != nil || owner != userID {
		t.Fatalf("owner: %v %v", err, owner)
	}
	owner2, err := q.GetCronOwnerViaService(ctx, serviceID)
	if err != nil || owner2 != userID {
		t.Fatalf("owner via service: %v %v", err, owner2)
	}
	pid, err := q.GetCronJobProjectID(ctx, jobID)
	if err != nil || pid != projectID {
		t.Fatalf("project: %v %v", err, pid)
	}

	// Trigger-shaped read.
	trig, err := q.GetCronJobForTrigger(ctx, jobID)
	if err != nil || trig.ServiceID != serviceID || trig.OwnerID != userID {
		t.Fatalf("trigger: %v %+v", err, trig)
	}

	// Execution lifecycle + retention trim.
	for i := 0; i < 3; i++ {
		execID := uuid.New()
		must(q.InsertCronExecution(ctx, sqlcdb.InsertCronExecutionParams{
			ID: execID, CronJobID: jobID,
			StartedAt: time.Now().Add(time.Duration(i) * time.Second),
			Status:    sql.NullString{String: "running", Valid: true},
		}))
		must(q.FinishCronExecution(ctx, sqlcdb.FinishCronExecutionParams{
			FinishedAt: sql.NullTime{Time: time.Now(), Valid: true},
			Status:     sql.NullString{String: "success", Valid: true},
			Output:     sql.NullString{String: "ok", Valid: true},
			Error:      sql.NullString{String: "", Valid: true},
			ID:         execID,
		}))
	}
	execs, err := q.ListCronExecutions(ctx, jobID)
	if err != nil || len(execs) != 3 {
		t.Fatalf("execs: %v %d", err, len(execs))
	}
	if execs[0].Status.String != "success" || !execs[0].FinishedAt.Valid {
		t.Fatalf("exec row: %+v", execs[0])
	}
	must(q.TrimCronExecutions(ctx, sqlcdb.TrimCronExecutionsParams{CronJobID: jobID, Limit: 1}))
	execs, _ = q.ListCronExecutions(ctx, jobID)
	if len(execs) != 1 {
		t.Fatalf("trim kept %d, want 1", len(execs))
	}

	must(q.UpdateCronJobRun(ctx, sqlcdb.UpdateCronJobRunParams{
		LastRunAt:  sql.NullTime{Time: time.Now(), Valid: true},
		LastStatus: sql.NullString{String: "success", Valid: true},
		LastOutput: sql.NullString{String: "ok", Valid: true},
		NextRunAt:  ntPtr(next),
		ID:         jobID,
	}))
	job, _ = q.GetCronJob(ctx, jobID)
	if job.LastStatus.String != "success" || !job.LastRunAt.Valid {
		t.Fatalf("post-run job: %+v", job)
	}

	must(q.DeleteCronJob(ctx, jobID))
	if _, err := q.GetCronJob(ctx, jobID); err == nil {
		t.Fatal("deleted job still readable")
	}
}
