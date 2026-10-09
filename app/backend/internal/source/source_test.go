package source

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestNormalizeCloneURL(t *testing.T) {
	cases := []struct {
		in, want string
		err      bool
	}{
		{"https://github.com/org/repo.git", "https://github.com/org/repo.git", false},
		{"git@github.com:org/repo.git", "https://github.com/org/repo.git", false},
		{"ssh://git@gitlab.example.com/org/repo.git", "https://gitlab.example.com/org/repo.git", false},
		{"org/repo", "org/repo", false},
		{"  https://gitlab.com/a/b.git  ", "https://gitlab.com/a/b.git", false},
		{"", "", true},
		{"ftp://example.com/repo", "", true},
		{"weird string", "", true},
	}
	for _, c := range cases {
		got, err := NormalizeCloneURL(c.in)
		if c.err {
			if err == nil {
				t.Errorf("%q: expected error, got %q", c.in, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("%q: unexpected error %v", c.in, err)
			continue
		}
		if got != c.want {
			t.Errorf("%q: got %q, want %q", c.in, got, c.want)
		}
	}
}

func TestValidateRemoteURL(t *testing.T) {
	if err := ValidateRemoteURL("https://github.com/o/r.git"); err != nil {
		t.Errorf("https should pass: %v", err)
	}
	if err := ValidateRemoteURL("file:///tmp/repo"); err == nil {
		t.Error("file:// should be rejected")
	}
	if err := ValidateRemoteURL("/tmp/repo"); err == nil {
		t.Error("local path should be rejected")
	}
}

// initRepo creates a small git repo with a branch and returns its path.
func initRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	run := func(args ...string) {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		cmd.Env = append(os.Environ(),
			"GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@t",
			"GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@t")
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %s", args, out)
		}
	}
	run("init", "-q", "-b", "main")
	if err := os.WriteFile(filepath.Join(dir, "app.txt"), []byte("v1"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "sub"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "sub", "inner.txt"), []byte("sub"), 0o644); err != nil {
		t.Fatal(err)
	}
	run("add", ".")
	run("commit", "-q", "-m", "first")
	return dir
}

func TestCheckoutBranch(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}
	repo := initRepo(t)
	dest := t.TempDir()
	dir, err := Checkout(context.Background(), dest, Spec{CloneURL: repo, Branch: "main"})
	if err != nil {
		t.Fatalf("checkout: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "app.txt")); err != nil {
		t.Errorf("expected app.txt in checkout: %v", err)
	}
}

func TestCheckoutBuildPath(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}
	repo := initRepo(t)
	dest := t.TempDir()
	dir, err := Checkout(context.Background(), dest, Spec{CloneURL: repo, Branch: "main", BuildPath: "sub"})
	if err != nil {
		t.Fatalf("checkout: %v", err)
	}
	if filepath.Base(dir) != "sub" {
		t.Errorf("expected sub build path, got %s", dir)
	}
	if _, err := os.Stat(filepath.Join(dir, "inner.txt")); err != nil {
		t.Errorf("expected inner.txt under build path: %v", err)
	}
}

func TestCheckoutCommit(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}
	repo := initRepo(t)
	out, err := exec.Command("git", "-C", repo, "rev-parse", "HEAD").Output()
	if err != nil {
		t.Fatal(err)
	}
	sha := string(out[:len(out)-1])
	dest := t.TempDir()
	dir, err := Checkout(context.Background(), dest, Spec{CloneURL: repo, Commit: sha, Branch: "main"})
	if err != nil {
		t.Fatalf("checkout commit: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "app.txt")); err != nil {
		t.Errorf("expected app.txt in pinned checkout: %v", err)
	}
}

func TestResolveBuildPathEscapes(t *testing.T) {
	root := t.TempDir()
	if _, err := ResolveBuildPath(root, "../../etc"); err == nil {
		t.Error("escape should be rejected")
	}
	if _, err := ResolveBuildPath(root, "/abs/path"); err == nil {
		t.Error("absolute path should be rejected")
	}
	if _, err := ResolveBuildPath(root, "missing"); err == nil {
		t.Error("missing dir should be rejected")
	}
	if got, err := ResolveBuildPath(root, "."); err != nil || got != root {
		t.Errorf("dot should resolve to root, got %q err=%v", got, err)
	}
}
