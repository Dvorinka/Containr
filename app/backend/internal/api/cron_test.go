package api

import (
	"strings"
	"testing"
	"time"
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
