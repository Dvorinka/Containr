package commands

import "testing"

func TestRailwayRepoURL(t *testing.T) {
	cases := map[string]string{
		"owner/repo":             "https://github.com/owner/repo",
		"https://gitlab.com/a/b": "https://gitlab.com/a/b",
		"git@github.com:a/b.git": "git@github.com:a/b.git",
		"":                       "",
		"-":                      "",
		"  spaced/x  ":           "https://github.com/spaced/x",
	}
	for in, want := range cases {
		if got := railwayRepoURL(in); got != want {
			t.Errorf("railwayRepoURL(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestEdgesOf(t *testing.T) {
	obj := map[string]interface{}{
		"services": map[string]interface{}{
			"edges": []interface{}{
				map[string]interface{}{"node": map[string]interface{}{"id": "a", "name": "web"}},
				map[string]interface{}{"node": map[string]interface{}{"id": "b", "name": "api"}},
			},
		},
	}
	nodes := edgesOf(obj, "services")
	if len(nodes) != 2 || str(nodes[0], "name") != "web" {
		t.Fatalf("edgesOf returned %+v", nodes)
	}
	if got := edgesOf(obj, "missing"); len(got) != 0 {
		t.Fatalf("edgesOf(missing) = %+v, want empty", got)
	}
	if got := edgesOf(map[string]interface{}{"services": nil}, "services"); len(got) != 0 {
		t.Fatalf("edgesOf(nil conn) = %+v, want empty", got)
	}
}

func TestDflowServicePlanOf(t *testing.T) {
	appSvc := map[string]interface{}{
		"id":           "s1",
		"name":         "api",
		"type":         "app",
		"providerType": "github",
		"githubSettings": map[string]interface{}{
			"owner": "acme", "repository": "api", "branch": "main",
			"buildPath": "/", "port": float64(8080),
		},
		"variables": []interface{}{
			map[string]interface{}{"key": "FOO", "value": "bar"},
			map[string]interface{}{"key": "EMPTY", "value": ""},
		},
		"domains": []interface{}{
			map[string]interface{}{"domain": "api.example.com"},
		},
		"volumes": []interface{}{
			map[string]interface{}{"hostPath": "/data", "containerPath": "/app/data"},
		},
	}
	plan, warn := dflowServicePlanOf(appSvc)
	if plan.Type != "web" || plan.GitRepo != "https://github.com/acme/api" || plan.Port != 8080 {
		t.Fatalf("app plan = %+v", plan)
	}
	if plan.Variables["FOO"] != "bar" || len(plan.Domains) != 1 || len(plan.Volumes) != 1 {
		t.Fatalf("plan detail = %+v", plan)
	}
	if len(warn) != 1 { // EMPTY value flagged
		t.Fatalf("warnings = %v", warn)
	}

	dbSvc := map[string]interface{}{
		"id": "s2", "name": "pg", "type": "database",
		"databaseDetails": map[string]interface{}{
			"type": "postgres", "version": "16", "provider": "external",
			"connectionUrl": "postgres://u:p@h:5432/db",
		},
	}
	dplan, _ := dflowServicePlanOf(dbSvc)
	if dplan.Type != "database" || dplan.Image != "postgres:16" {
		t.Fatalf("db plan = %+v", dplan)
	}
	if dplan.Variables["DATABASE_URL"] != "postgres://u:p@h:5432/db" {
		t.Fatalf("db vars = %+v", dplan.Variables)
	}

	dockerSvc := map[string]interface{}{
		"id": "s3", "name": "img", "type": "docker",
		"dockerDetails": map[string]interface{}{
			"url": "ghrc://acme/web:v1",
			"ports": []interface{}{
				map[string]interface{}{"hostPort": float64(80), "containerPort": float64(3000), "scheme": "http"},
			},
		},
	}
	iplan, _ := dflowServicePlanOf(dockerSvc)
	if iplan.Image != "ghcr.io/acme/web:v1" || iplan.Port != 3000 {
		t.Fatalf("docker plan = %+v", iplan)
	}
}

func TestDflowRepoURL(t *testing.T) {
	cases := []struct {
		provider, owner, repo, want string
	}{
		{"github", "acme", "api", "https://github.com/acme/api"},
		{"gitlab", "acme", "api", "https://gitlab.com/acme/api"},
		{"bitbucket", "acme", "api", "https://bitbucket.org/acme/api"},
		{"gitea", "acme", "api", ""},
		{"github", "acme", "api.git", "https://github.com/acme/api"},
		{"github", "", "api", ""},
		{"github", "acme", "", ""},
		{"github", "acme", "https://git.example.com/a/b", "https://git.example.com/a/b"},
	}
	for _, c := range cases {
		if got := dflowRepoURL(c.provider, c.owner, c.repo); got != c.want {
			t.Errorf("dflowRepoURL(%q,%q,%q) = %q, want %q", c.provider, c.owner, c.repo, got, c.want)
		}
	}
}
