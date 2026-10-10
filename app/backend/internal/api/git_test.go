package api

import (
	"context"
	"database/sql"
	"strings"
	"testing"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"

	"github.com/google/uuid"
)

func TestNormalizeRepositoryFullName(t *testing.T) {
	cases := []struct {
		name         string
		input        string
		wantName     string
		wantFullName string
		wantErr      bool
	}{
		{
			name:         "owner slash repo",
			input:        "acme/platform",
			wantName:     "platform",
			wantFullName: "acme/platform",
		},
		{
			name:         "https clone URL",
			input:        "https://github.com/acme/platform.git",
			wantName:     "platform",
			wantFullName: "acme/platform",
		},
		{
			name:         "ssh URL",
			input:        "git@github.com:acme/platform.git",
			wantName:     "platform",
			wantFullName: "acme/platform",
		},
		{
			name:    "invalid format",
			input:   "acme",
			wantErr: true,
		},
		{
			name:    "empty",
			input:   "",
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotName, gotFullName, err := normalizeRepositoryFullName(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
			if gotName != tc.wantName {
				t.Fatalf("name mismatch: got %q want %q", gotName, tc.wantName)
			}
			if gotFullName != tc.wantFullName {
				t.Fatalf("full name mismatch: got %q want %q", gotFullName, tc.wantFullName)
			}
		})
	}
}

func TestDeriveCloneURL(t *testing.T) {
	fullName := "acme/platform"
	cases := []struct {
		provider string
		want     string
	}{
		{provider: "github", want: "https://github.com/acme/platform.git"},
		{provider: "gitlab", want: "https://gitlab.com/acme/platform.git"},
		{provider: "bitbucket", want: "https://bitbucket.org/acme/platform.git"},
		{provider: "unknown", want: "acme/platform"},
	}

	for _, tc := range cases {
		t.Run(tc.provider, func(t *testing.T) {
			got := deriveCloneURL(tc.provider, fullName)
			if got != tc.want {
				t.Fatalf("deriveCloneURL(%q) = %q, want %q", tc.provider, got, tc.want)
			}
		})
	}
}

// Live invariant test against real Postgres — set METRICS_TEST_DSN (or
// DATABASE_URL). Covers the generated git provider/repo/webhook queries plus
// the push-dispatch service matcher (empty branch must match all branches).
func TestGitLiveInvariants(t *testing.T) {
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
	providerID := uuid.New()
	repoID := uuid.New()
	webhookID := uuid.New()
	svcMain := uuid.New()
	svcDev := uuid.New()
	suffix := strings.ReplaceAll(userID.String()[:8], "-", "")
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatalf("setup: %v", err)
		}
	}
	_, err = db.Exec(`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, 'x', 'test')`,
		userID, "git-"+suffix+"@test.local")
	must(err)
	_, err = db.Exec(`INSERT INTO projects (id, name, owner_id, is_approved) VALUES ($1, $2, $3, true)`,
		projectID, "git-"+suffix, userID)
	must(err)
	_, err = db.Exec(`INSERT INTO environments (id, name, project_id) VALUES ($1, 'production', $2)`,
		envID, projectID)
	must(err)
	defer func() { _, _ = db.Exec(`DELETE FROM users WHERE id = $1`, userID) }()

	// Provider lifecycle.
	must(q.InsertGitProvider(ctx, sqlcdb.InsertGitProviderParams{
		ID: providerID, Name: "github", DisplayName: "GitHub",
		ApiUrl: "https://api.github.com", WebhookUrl: "https://hooks.test",
		AccessToken: "tok", UserID: userID,
	}))
	providers, err := q.ListGitProviders(ctx, userID)
	if err != nil || len(providers) == 0 {
		t.Fatalf("providers: %v %v", err, providers)
	}
	name, err := q.GetGitProviderNameByID(ctx, providerID)
	if err != nil || name != "github" {
		t.Fatalf("provider name: %v %q", err, name)
	}
	fetch, err := q.GetGitProviderForFetch(ctx, sqlcdb.GetGitProviderForFetchParams{ID: providerID, UserID: userID})
	if err != nil || fetch.AccessToken != "tok" || fetch.ApiUrl != "https://api.github.com" {
		t.Fatalf("fetch: %v %+v", err, fetch)
	}

	// Repository insert + search.
	cloneURL := "https://github.com/acme/svc-" + suffix + ".git"
	fullName := "acme/svc-" + suffix
	_, err = q.InsertGitRepository(ctx, sqlcdb.InsertGitRepositoryParams{
		ID: repoID, ProviderID: providerID, Name: "svc-" + suffix, FullName: fullName,
		Description:   sql.NullString{String: "", Valid: true},
		CloneUrl:      cloneURL,
		DefaultBranch: sql.NullString{String: "main", Valid: true},
		IsPrivate:     sql.NullBool{Bool: false, Valid: true},
		UserID:        userID,
	})
	must(err)
	byName, err := q.GetGitRepositoryByFullName(ctx, sqlcdb.GetGitRepositoryByFullNameParams{
		ProviderID: providerID, FullName: fullName, UserID: userID,
	})
	if err != nil || byName.ID != repoID || byName.CloneUrl != cloneURL {
		t.Fatalf("repo by full name: %v %+v", err, byName)
	}
	all, err := q.ListGitRepositories(ctx, sqlcdb.ListGitRepositoriesParams{
		ProviderID: providerID, UserID: userID, Column3: "", Limit: 50, Offset: 0,
	})
	if err != nil || len(all) == 0 {
		t.Fatalf("repo list (empty search): %v %v", err, all)
	}
	hit, err := q.ListGitRepositories(ctx, sqlcdb.ListGitRepositoriesParams{
		ProviderID: providerID, UserID: userID, Column3: "svc-" + suffix, Limit: 50, Offset: 0,
	})
	if err != nil || len(hit) != 1 || hit[0].ID != repoID {
		t.Fatalf("repo list (matching search): %v %v", err, hit)
	}
	miss, err := q.ListGitRepositories(ctx, sqlcdb.ListGitRepositoriesParams{
		ProviderID: providerID, UserID: userID, Column3: "zzz-no-match", Limit: 50, Offset: 0,
	})
	if err != nil || len(miss) != 0 {
		t.Fatalf("repo list (non-matching search): %v %v", err, miss)
	}
	count, err := q.CountGitRepositories(ctx, sqlcdb.CountGitRepositoriesParams{
		ProviderID: providerID, UserID: userID, Column3: "",
	})
	if err != nil || count < 1 {
		t.Fatalf("repo count: %v %d", err, count)
	}
	// Upsert on (provider_id, full_name) conflict — updates rather than errors.
	must(q.UpsertGitRepository(ctx, sqlcdb.UpsertGitRepositoryParams{
		ID: uuid.New(), ProviderID: providerID, Name: "renamed-" + suffix, FullName: fullName,
		Description:   sql.NullString{String: "d", Valid: true},
		CloneUrl:      cloneURL,
		DefaultBranch: sql.NullString{String: "main", Valid: true},
		IsPrivate:     sql.NullBool{Bool: true, Valid: true},
		UserID:        userID,
	}))
	byName, err = q.GetGitRepositoryByFullName(ctx, sqlcdb.GetGitRepositoryByFullNameParams{
		ProviderID: providerID, FullName: fullName, UserID: userID,
	})
	if err != nil || byName.Name != "renamed-"+suffix {
		t.Fatalf("repo after upsert: %v %+v", err, byName)
	}

	// Connected-repos join + webhook lifecycle.
	connected, err := q.ListConnectedRepositories(ctx, sqlcdb.ListConnectedRepositoriesParams{
		UserID: userID, Limit: 50, Offset: 0,
	})
	if err != nil || len(connected) == 0 {
		t.Fatalf("connected repos: %v %v", err, connected)
	}
	wh, err := q.UpsertGitWebhook(ctx, sqlcdb.UpsertGitWebhookParams{
		ID: webhookID, RepoID: repoID, ProviderID: providerID,
		Events: "push", WebhookSecret: "sec-" + suffix,
		BranchFilter: sql.NullString{String: "", Valid: true},
	})
	must(err)
	if !wh.Active.Bool {
		t.Fatalf("webhook inactive after upsert: %+v", wh)
	}
	push, err := q.GetGitWebhookForPush(ctx, webhookID)
	if err != nil || push.WebhookSecret != "sec-"+suffix || push.ProviderID != providerID {
		t.Fatalf("webhook for push: %v %+v", err, push)
	}
	pushRepo, err := q.GetGitRepoForPush(ctx, repoID)
	if err != nil || pushRepo.CloneUrl != cloneURL || pushRepo.FullName != fullName || pushRepo.UserID != userID {
		t.Fatalf("repo for push: %v %+v", err, pushRepo)
	}

	// Push-dispatch service matcher: branch filter and empty-branch match-all.
	for id, branch := range map[uuid.UUID]string{svcMain: "main", svcDev: "dev"} {
		_, err = db.Exec(`INSERT INTO services (id, name, project_id, environment_id, service_type, source_type, git_repo, git_branch)
			VALUES ($1, $2, $3, $4, 'web', 'git', $5, $6)`,
			id, "svc-"+suffix+"-"+branch, projectID, envID, cloneURL, branch)
		must(err)
	}
	servicesFor := func(branch string) []sqlcdb.ListServicesForPushRow {
		rows, err := q.ListServicesForPush(ctx, sqlcdb.ListServicesForPushParams{
			GitBranch: sql.NullString{String: branch, Valid: true},
			GitRepo:   sql.NullString{String: cloneURL, Valid: true},
			GitRepo_2: sql.NullString{String: fullName, Valid: true},
		})
		if err != nil {
			t.Fatalf("services for push %q: %v", branch, err)
		}
		return rows
	}
	mainRows := servicesFor("main")
	if len(mainRows) != 1 || mainRows[0].ID != svcMain || mainRows[0].GitBranch != "main" {
		t.Fatalf("main branch dispatch: %+v", mainRows)
	}
	devRows := servicesFor("dev")
	if len(devRows) != 1 || devRows[0].ID != svcDev {
		t.Fatalf("dev branch dispatch: %+v", devRows)
	}
	allRows := servicesFor("")
	if len(allRows) != 2 {
		t.Fatalf("empty-branch dispatch should match all: %+v", allRows)
	}
	// Repo may also be referenced by its full_name.
	fullRows, err := q.ListServicesForPush(ctx, sqlcdb.ListServicesForPushParams{
		GitBranch: sql.NullString{String: "main", Valid: true},
		GitRepo:   sql.NullString{String: "git@github.com:other/none.git", Valid: true},
		GitRepo_2: sql.NullString{String: cloneURL, Valid: true},
	})
	if err != nil || len(fullRows) != 1 {
		t.Fatalf("full-name repo match: %v %+v", err, fullRows)
	}

	// Provider delete is owner-scoped.
	other, err := q.DeleteGitProvider(ctx, sqlcdb.DeleteGitProviderParams{ID: providerID, UserID: uuid.New()})
	if err != nil || other != 0 {
		t.Fatalf("foreign delete affected %d rows: %v", other, err)
	}
	deleted, err := q.DeleteGitProvider(ctx, sqlcdb.DeleteGitProviderParams{ID: providerID, UserID: userID})
	if err != nil || deleted != 1 {
		t.Fatalf("owner delete affected %d rows: %v", deleted, err)
	}
}
