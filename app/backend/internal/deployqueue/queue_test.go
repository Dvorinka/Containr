package deployqueue

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestSerializesPerService(t *testing.T) {
	q := New()
	svc := uuid.New()

	var active, maxActive int32
	finish := make(chan struct{})
	for i := 0; i < 3; i++ {
		q.Enqueue(svc, Job{Run: func(ctx context.Context) {
			if n := atomic.AddInt32(&active, 1); n > atomic.LoadInt32(&maxActive) {
				atomic.StoreInt32(&maxActive, n)
			}
			<-finish // hold until released
			atomic.AddInt32(&active, -1)
		}})
	}

	deadline := time.After(2 * time.Second)
	for atomic.LoadInt32(&active) < 1 {
		select {
		case <-deadline:
			t.Fatal("first job never started")
		default:
			time.Sleep(time.Millisecond)
		}
	}
	close(finish)
	deadline = time.After(2 * time.Second)
	for atomic.LoadInt32(&active) > 0 {
		select {
		case <-deadline:
			t.Fatal("jobs did not drain")
		default:
			time.Sleep(time.Millisecond)
		}
	}
	if got := atomic.LoadInt32(&maxActive); got != 1 {
		t.Fatalf("expected max concurrency 1, got %d", got)
	}
}

func TestDifferentServicesRunInParallel(t *testing.T) {
	q := New()
	started := make(chan struct{}, 2)
	release := make(chan struct{})
	for i := 0; i < 2; i++ {
		q.Enqueue(uuid.New(), Job{Run: func(ctx context.Context) {
			started <- struct{}{}
			<-release
		}})
	}
	for i := 0; i < 2; i++ {
		select {
		case <-started:
		case <-time.After(2 * time.Second):
			t.Fatal("parallel services did not both start")
		}
	}
	close(release)
}

func TestCancelQueuedRemovesJob(t *testing.T) {
	q := New()
	svc := uuid.New()
	release := make(chan struct{})
	q.Enqueue(svc, Job{DeploymentID: uuid.New(), Run: func(ctx context.Context) { <-release }})

	queuedID := uuid.New()
	ran := make(chan struct{})
	q.Enqueue(svc, Job{DeploymentID: queuedID, Run: func(ctx context.Context) { close(ran) }})

	if got := q.Cancel(svc, queuedID); got != WasQueued {
		t.Fatalf("expected WasQueued, got %v", got)
	}
	close(release)
	select {
	case <-ran:
		t.Fatal("cancelled queued job still ran")
	case <-time.After(200 * time.Millisecond):
	}
}

func TestCancelActiveCancelsContext(t *testing.T) {
	q := New()
	svc := uuid.New()
	id := uuid.New()
	ctxDone := make(chan struct{})
	q.Enqueue(svc, Job{DeploymentID: id, Run: func(ctx context.Context) {
		<-ctx.Done()
		close(ctxDone)
	}})

	deadline := time.After(2 * time.Second)
	for {
		q.mu.Lock()
		_, ok := q.cancels[id]
		q.mu.Unlock()
		if ok {
			break
		}
		select {
		case <-deadline:
			t.Fatal("job never registered")
		default:
			time.Sleep(time.Millisecond)
		}
	}
	if got := q.Cancel(svc, id); got != WasActive {
		t.Fatalf("expected WasActive, got %v", got)
	}
	select {
	case <-ctxDone:
	case <-time.After(2 * time.Second):
		t.Fatal("active job context not cancelled")
	}
}

func TestSnapshot(t *testing.T) {
	q := New()
	if got := q.Snapshot(); len(got) != 0 {
		t.Fatalf("empty queue snapshot = %v, want empty", got)
	}

	svc := uuid.New()
	release := make(chan struct{})
	q.Enqueue(svc, Job{Run: func(ctx context.Context) { <-release }})
	q.Enqueue(svc, Job{Run: func(ctx context.Context) {}})
	q.Enqueue(svc, Job{Run: func(ctx context.Context) {}})

	deadline := time.After(2 * time.Second)
	for {
		snap := q.Snapshot()
		if len(snap) == 1 && snap[0].Running {
			if snap[0].ServiceID != svc {
				t.Fatalf("snapshot service = %v, want %v", snap[0].ServiceID, svc)
			}
			if snap[0].Queued != 2 {
				t.Fatalf("queued = %d, want 2", snap[0].Queued)
			}
			close(release)
			return
		}
		select {
		case <-deadline:
			t.Fatalf("snapshot never showed running job: %v", snap)
		default:
			time.Sleep(time.Millisecond)
		}
	}
}

func TestEnqueuePosition(t *testing.T) {
	q := New()
	svc := uuid.New()
	release := make(chan struct{})
	if pos := q.Enqueue(svc, Job{Run: func(ctx context.Context) { <-release }}); pos != 0 {
		t.Fatalf("first job position = %d, want 0", pos)
	}
	if pos := q.Enqueue(svc, Job{Run: func(ctx context.Context) {}}); pos != 1 {
		t.Fatalf("second job position = %d, want 1", pos)
	}
	if pos := q.Enqueue(svc, Job{Run: func(ctx context.Context) {}}); pos != 2 {
		t.Fatalf("third job position = %d, want 2", pos)
	}
	close(release)
}
