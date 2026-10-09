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
