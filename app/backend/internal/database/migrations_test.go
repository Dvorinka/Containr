package database

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestIsManagedMigrationFile(t *testing.T) {
	cases := []struct {
		name     string
		fileName string
		want     bool
	}{
		{name: "valid triple digit migration", fileName: "001_initial_schema.sql", want: true},
		{name: "supports higher migration number", fileName: "120_add_table.sql", want: true},
		{name: "legacy sqlite migration excluded", fileName: "0001_init.sql", want: false},
		{name: "backup file excluded", fileName: "001_initial_schema.sql.bak", want: false},
		{name: "non migration sql excluded", fileName: "seed.sql", want: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := isManagedMigrationFile(tc.fileName)
			if got != tc.want {
				t.Fatalf("isManagedMigrationFile(%q) = %v, want %v", tc.fileName, got, tc.want)
			}
		})
	}
}

func TestListManagedMigrationFiles(t *testing.T) {
	dir := t.TempDir()
	files := []string{
		"020_add_database_templates.sql",
		"001_initial_schema.sql",
		"0001_init.sql",
		"README.txt",
		"021_expand_database_service_types.sql",
	}

	for _, file := range files {
		path := filepath.Join(dir, file)
		if err := os.WriteFile(path, []byte("-- test"), 0o644); err != nil {
			t.Fatalf("failed to write temp file %s: %v", file, err)
		}
	}

	got, err := listManagedMigrationFiles(dir)
	if err != nil {
		t.Fatalf("listManagedMigrationFiles returned error: %v", err)
	}

	want := []string{
		"001_initial_schema.sql",
		"020_add_database_templates.sql",
		"021_expand_database_service_types.sql",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("listManagedMigrationFiles = %v, want %v", got, want)
	}
}
