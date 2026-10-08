package api

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestMarkIdleTracksCounter(t *testing.T) {
	id := uuid.New()
	timeout := 50 * time.Millisecond

	// First sighting sets the baseline only.
	if markIdle(id, 100, timeout) {
		t.Fatal("slept on first sighting")
	}
	// Counter growth resets the idle clock.
	if markIdle(id, 200, timeout) {
		t.Fatal("slept while counter grew")
	}
	// Flat counter within the window doesn't sleep.
	if markIdle(id, 200, timeout) {
		t.Fatal("slept before timeout")
	}
	time.Sleep(60 * time.Millisecond)
	if !markIdle(id, 200, timeout) {
		t.Fatal("did not sleep after timeout")
	}
}

func TestMarkIdleZeroCounterSleeps(t *testing.T) {
	id := uuid.New()
	timeout := 20 * time.Millisecond

	markIdle(id, 0, timeout)
	time.Sleep(30 * time.Millisecond)
	if !markIdle(id, 0, timeout) {
		t.Fatal("zero-traffic service never slept")
	}
}
