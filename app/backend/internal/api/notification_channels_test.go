package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"containr/internal/database/sqlcdb"
)

func TestDeliverPushNtfy(t *testing.T) {
	var gotAuth, gotTitle, gotTags, gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotTitle = r.Header.Get("Title")
		gotTags = r.Header.Get("Tags")
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	ch := sqlcdb.NotificationChannel{
		Kind:     "ntfy",
		Endpoint: srv.URL + "/alerts",
		Token:    sql.NullString{String: "tk_abc", Valid: true},
	}
	if err := deliverPush(context.Background(), ch, "deployment", "Deploy done", "svc is live"); err != nil {
		t.Fatalf("deliverPush: %v", err)
	}
	if gotAuth != "Bearer tk_abc" {
		t.Fatalf("auth header = %q", gotAuth)
	}
	if gotTitle != "Deploy done" || gotTags != "containr,deployment" || gotBody != "svc is live" {
		t.Fatalf("title=%q tags=%q body=%q", gotTitle, gotTags, gotBody)
	}
}

func TestDeliverPushGotify(t *testing.T) {
	var gotPath, gotToken string
	var payload map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotToken = r.URL.Query().Get("token")
		_ = json.NewDecoder(r.Body).Decode(&payload)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	ch := sqlcdb.NotificationChannel{
		Kind:     "gotify",
		Endpoint: srv.URL,
		Token:    sql.NullString{String: "apptoken", Valid: true},
	}
	if err := deliverPush(context.Background(), ch, "backup", "Backup done", "db backup ok"); err != nil {
		t.Fatalf("deliverPush: %v", err)
	}
	if gotPath != "/message" || gotToken != "apptoken" {
		t.Fatalf("path=%q token=%q", gotPath, gotToken)
	}
	if payload["title"] != "Backup done" || payload["message"] != "db backup ok" {
		t.Fatalf("payload = %v", payload)
	}
}

func TestDeliverPushFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	ch := sqlcdb.NotificationChannel{Kind: "ntfy", Endpoint: srv.URL}
	if err := deliverPush(context.Background(), ch, "k", "t", "b"); err == nil {
		t.Fatal("expected error on 500")
	}
}
