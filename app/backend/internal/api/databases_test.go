package api

import (
	"strings"
	"testing"

	"github.com/docker/go-connections/nat"
)

func TestNormalizeDatabaseType(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: "postgres", want: "postgresql"},
		{input: "postgresql", want: "postgresql"},
		{input: "pg", want: "postgresql"},
		{input: "redis", want: "redis"},
		{input: "dragonflydb", want: "dragonfly"},
		{input: "dragonfly", want: "dragonfly"},
		{input: "mysql", want: "mysql"},
		{input: "mariadb", want: "mariadb"},
		{input: "mongo", want: "mongodb"},
		{input: "mongodb", want: "mongodb"},
		{input: "clickhouse", want: "clickhouse"},
	}

	for _, tt := range tests {
		got := normalizeDatabaseType(tt.input)
		if got != tt.want {
			t.Fatalf("normalizeDatabaseType(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestDatabaseConnectionURLAndDefaultVersion(t *testing.T) {
	handler := &DatabaseHandler{}

	cases := []struct {
		dbType      string
		urlContains string
		version     string
	}{
		{dbType: "postgresql", urlContains: "postgresql://", version: "16.2"},
		{dbType: "redis", urlContains: "redis://", version: "7.2"},
		{dbType: "dragonfly", urlContains: "redis://", version: "1.24"},
		{dbType: "mysql", urlContains: "mysql://", version: "8.4"},
		{dbType: "mariadb", urlContains: "mysql://", version: "11.4"},
		{dbType: "mongodb", urlContains: "mongodb://", version: "7.0"},
		{dbType: "clickhouse", urlContains: "http://", version: "24.8"},
	}

	for _, tc := range cases {
		url := handler.generateConnectionURL(DatabaseService{
			Type: tc.dbType,
			Name: "example",
		})
		if url == "" {
			t.Fatalf("generateConnectionURL returned empty for type %q", tc.dbType)
		}
		if len(tc.urlContains) > 0 && !strings.HasPrefix(url, tc.urlContains) {
			t.Fatalf("generateConnectionURL(%q) = %q, expected prefix %q", tc.dbType, url, tc.urlContains)
		}

		gotVersion := handler.getDefaultVersion(tc.dbType)
		if gotVersion != tc.version {
			t.Fatalf("getDefaultVersion(%q) = %q, want %q", tc.dbType, gotVersion, tc.version)
		}
	}
}

func TestBuildDatabaseRuntimePlanSupportsAllTypes(t *testing.T) {
	cases := []struct {
		dbType        string
		expectedImage string
		expectedPort  nat.Port
		urlPrefix     string
	}{
		{dbType: "postgresql", expectedImage: "postgres:16-alpine", expectedPort: nat.Port("5432/tcp"), urlPrefix: "postgresql://"},
		{dbType: "redis", expectedImage: "redis:7-alpine", expectedPort: nat.Port("6379/tcp"), urlPrefix: "redis://"},
		{dbType: "dragonfly", expectedImage: "docker.dragonflydb.io/dragonflydb/dragonfly:latest", expectedPort: nat.Port("6379/tcp"), urlPrefix: "redis://"},
		{dbType: "mysql", expectedImage: "mysql:8.4", expectedPort: nat.Port("3306/tcp"), urlPrefix: "mysql://"},
		{dbType: "mariadb", expectedImage: "mariadb:11", expectedPort: nat.Port("3306/tcp"), urlPrefix: "mysql://"},
		{dbType: "mongodb", expectedImage: "mongo:7", expectedPort: nat.Port("27017/tcp"), urlPrefix: "mongodb://"},
		{dbType: "clickhouse", expectedImage: "clickhouse/clickhouse-server:24.8", expectedPort: nat.Port("8123/tcp"), urlPrefix: "http://"},
	}

	for _, tc := range cases {
		plan, err := buildDatabaseRuntimePlan(tc.dbType, "My DB", nil)
		if err != nil {
			t.Fatalf("buildDatabaseRuntimePlan(%q) returned error: %v", tc.dbType, err)
		}
		if plan.Image != tc.expectedImage {
			t.Fatalf("buildDatabaseRuntimePlan(%q) image=%q want=%q", tc.dbType, plan.Image, tc.expectedImage)
		}
		if plan.Port != tc.expectedPort {
			t.Fatalf("buildDatabaseRuntimePlan(%q) port=%q want=%q", tc.dbType, plan.Port, tc.expectedPort)
		}
		conn := plan.ConnectionURL("12345")
		if !strings.HasPrefix(conn, tc.urlPrefix) {
			t.Fatalf("buildDatabaseRuntimePlan(%q) connectionURL=%q expected prefix=%q", tc.dbType, conn, tc.urlPrefix)
		}
	}
}

func TestBuildDatabaseRuntimePlanHonorsRuntimeVariables(t *testing.T) {
	plan, err := buildDatabaseRuntimePlan("postgresql", "mydb", map[string]string{
		"POSTGRES_USER":     "template_user",
		"POSTGRES_PASSWORD": "template_pass",
		"POSTGRES_DB":       "template_db",
	})
	if err != nil {
		t.Fatalf("buildDatabaseRuntimePlan returned error: %v", err)
	}

	envJoined := strings.Join(plan.Env, " ")
	if !strings.Contains(envJoined, "POSTGRES_USER=template_user") {
		t.Fatalf("expected POSTGRES_USER override in env, got: %s", envJoined)
	}
	if !strings.Contains(envJoined, "POSTGRES_PASSWORD=template_pass") {
		t.Fatalf("expected POSTGRES_PASSWORD override in env, got: %s", envJoined)
	}
	if !strings.Contains(envJoined, "POSTGRES_DB=template_db") {
		t.Fatalf("expected POSTGRES_DB override in env, got: %s", envJoined)
	}

	url := plan.ConnectionURL("54321")
	if !strings.Contains(url, "template_user:template_pass") || !strings.Contains(url, "/template_db") {
		t.Fatalf("expected connection URL to reflect runtime overrides, got: %s", url)
	}
}

func TestGenerateDatabaseIDIncludesRandomSuffix(t *testing.T) {
	id1 := generateDatabaseID("Main DB")
	id2 := generateDatabaseID("Main DB")
	if id1 == id2 {
		t.Fatalf("expected generateDatabaseID to produce unique values, got identical id %q", id1)
	}
	if !strings.HasPrefix(id1, "db_") || !strings.Contains(id1, "_main_db_") {
		t.Fatalf("unexpected database id format: %s", id1)
	}
}

func TestManagedDatabaseNamesAreBoundedAndStable(t *testing.T) {
	id := "db_1234567890_this-is-a-very-very-very-very-very-long-name"
	containerName := managedDatabaseContainerName(id)
	volumeName := managedDatabaseVolumeName(id)

	if containerName == "" || volumeName == "" {
		t.Fatal("expected non-empty managed runtime names")
	}
	if len(containerName) > 63 {
		t.Fatalf("container name too long: %d", len(containerName))
	}
	if len(volumeName) > 63 {
		t.Fatalf("volume name too long: %d", len(volumeName))
	}
	if !strings.HasPrefix(containerName, "containr-db-") {
		t.Fatalf("unexpected container prefix: %s", containerName)
	}
	if !strings.HasPrefix(volumeName, "containr-db-vol-") {
		t.Fatalf("unexpected volume prefix: %s", volumeName)
	}
}

func TestSanitizeBackupArchivePath(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: "backup_abc.tar.gz", want: "backup_abc.tar.gz"},
		{input: "/tmp/../../danger", want: "tmp_danger.tar.gz"},
		{input: " weird name ", want: "weird_name.tar.gz"},
		{input: "", want: "backup.tar.gz"},
	}

	for _, tt := range tests {
		got := sanitizeBackupArchivePath(tt.input)
		if got != tt.want {
			t.Fatalf("sanitizeBackupArchivePath(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestHumanReadableBytes(t *testing.T) {
	tests := []struct {
		size int64
		want string
	}{
		{size: 0, want: "0 B"},
		{size: 1024, want: "1.00 KB"},
		{size: 1048576, want: "1.00 MB"},
	}

	for _, tt := range tests {
		got := humanReadableBytes(tt.size)
		if got != tt.want {
			t.Fatalf("humanReadableBytes(%d) = %q, want %q", tt.size, got, tt.want)
		}
	}
}
