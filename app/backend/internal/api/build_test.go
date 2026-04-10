package api

import (
	"context"
	"testing"
	"time"
)

func TestBuildHandlerGetBuildReturnsClone(t *testing.T) {
	handler := NewBuildHandler(nil, nil, nil)
	handler.storeBuild(&BuildStatusResponse{
		ID:        "build-1",
		ProjectID: "proj-1",
		Status:    "pending",
		StartedAt: time.Now().UTC(),
		Metadata: map[string]string{
			"branch": "main",
		},
	})

	got, ok := handler.getBuild("build-1")
	if !ok {
		t.Fatalf("expected build to exist")
	}

	got.Metadata["branch"] = "feature-x"
	reloaded, ok := handler.getBuild("build-1")
	if !ok {
		t.Fatalf("expected build to still exist")
	}

	if reloaded.Metadata["branch"] != "main" {
		t.Fatalf("expected metadata clone behavior, got %q", reloaded.Metadata["branch"])
	}
}

func TestBuildHandlerListBuildsFilterAndPagination(t *testing.T) {
	handler := NewBuildHandler(nil, nil, nil)
	now := time.Now().UTC()

	handler.storeBuild(&BuildStatusResponse{
		ID:        "build-1",
		ProjectID: "proj-1",
		ServiceID: "svc-1",
		Status:    "success",
		StartedAt: now.Add(-3 * time.Minute),
	})
	handler.storeBuild(&BuildStatusResponse{
		ID:        "build-2",
		ProjectID: "proj-1",
		ServiceID: "svc-2",
		Status:    "running",
		StartedAt: now.Add(-2 * time.Minute),
	})
	handler.storeBuild(&BuildStatusResponse{
		ID:        "build-3",
		ProjectID: "proj-2",
		ServiceID: "svc-1",
		Status:    "failed",
		StartedAt: now.Add(-1 * time.Minute),
	})

	filtered, total := handler.listBuilds("proj-1", "", "", 1, 10)
	if total != 2 {
		t.Fatalf("expected total 2, got %d", total)
	}
	if len(filtered) != 2 {
		t.Fatalf("expected 2 builds on page, got %d", len(filtered))
	}
	if filtered[0].ID != "build-2" {
		t.Fatalf("expected newest first (build-2), got %s", filtered[0].ID)
	}

	page1, total := handler.listBuilds("", "", "", 1, 2)
	if total != 3 {
		t.Fatalf("expected total 3, got %d", total)
	}
	if len(page1) != 2 {
		t.Fatalf("expected first page length 2, got %d", len(page1))
	}
	if page1[0].ID != "build-3" || page1[1].ID != "build-2" {
		t.Fatalf("unexpected first page order: %s, %s", page1[0].ID, page1[1].ID)
	}

	page2, _ := handler.listBuilds("", "", "", 2, 2)
	if len(page2) != 1 || page2[0].ID != "build-1" {
		t.Fatalf("unexpected second page: %+v", page2)
	}
}

func TestBuildHandlerCancelBuild(t *testing.T) {
	handler := NewBuildHandler(nil, nil, nil)
	handler.storeBuild(&BuildStatusResponse{
		ID:        "build-1",
		Status:    "running",
		StartedAt: time.Now().UTC(),
	})

	cancelled := false
	handler.cancels["build-1"] = func() {
		cancelled = true
	}

	if ok := handler.cancelBuild("build-1"); !ok {
		t.Fatalf("expected cancelBuild to succeed")
	}
	if !cancelled {
		t.Fatalf("expected context cancel to be called")
	}

	build, ok := handler.getBuild("build-1")
	if !ok {
		t.Fatalf("expected build to exist")
	}
	if build.Status != "cancelled" {
		t.Fatalf("expected status cancelled, got %s", build.Status)
	}
	if build.CompletedAt == nil {
		t.Fatalf("expected completed_at to be set")
	}
}

func TestBuildHandlerCancelBuildTerminalState(t *testing.T) {
	handler := NewBuildHandler(nil, nil, nil)
	handler.storeBuild(&BuildStatusResponse{
		ID:        "build-1",
		Status:    "success",
		StartedAt: time.Now().UTC(),
	})
	handler.cancels["build-1"] = context.CancelFunc(func() {})

	if ok := handler.cancelBuild("build-1"); ok {
		t.Fatalf("expected cancelBuild to reject terminal state")
	}
}
