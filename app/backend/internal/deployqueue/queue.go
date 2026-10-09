package deployqueue

import (
	"context"
	"sync"

	"github.com/google/uuid"
)

// Job is a unit of serialized deployment work. DeploymentID is the
// deployments row it mirrors (uuid.Nil for runtime ops with no row).
// Run is invoked with a cancellable context — cancelled by Cancel for
// active jobs, or the job is dropped before starting when queued.
type Job struct {
	DeploymentID uuid.UUID
	Run          func(ctx context.Context)
}

// Queue serializes deploy work per service: one active job, the rest FIFO.
// A build for service A never races a redeploy or second build of A, while
// services B, C proceed in parallel. Not a global worker pool — per-service
// serialization is what prevents container thrash.
type Queue struct {
	mu      sync.Mutex
	states  map[uuid.UUID]*serviceState
	cancels map[uuid.UUID]context.CancelFunc
}

type serviceState struct {
	running bool
	pending []Job
}

func New() *Queue {
	return &Queue{
		states:  make(map[uuid.UUID]*serviceState),
		cancels: make(map[uuid.UUID]context.CancelFunc),
	}
}

// Enqueue schedules a job. Returns the position: 0 means it starts
// immediately, >0 means that many jobs run first.
func (q *Queue) Enqueue(serviceID uuid.UUID, job Job) int {
	q.mu.Lock()
	st := q.states[serviceID]
	if st == nil {
		st = &serviceState{}
		q.states[serviceID] = st
	}
	if st.running {
		st.pending = append(st.pending, job)
		pos := len(st.pending)
		q.mu.Unlock()
		return pos
	}
	st.running = true
	q.mu.Unlock()

	q.start(serviceID, job)
	return 0
}

func (q *Queue) start(serviceID uuid.UUID, job Job) {
	ctx, cancel := context.WithCancel(context.Background())
	if job.DeploymentID != uuid.Nil {
		q.mu.Lock()
		q.cancels[job.DeploymentID] = cancel
		q.mu.Unlock()
	}

	go func() {
		defer func() {
			if job.DeploymentID != uuid.Nil {
				q.mu.Lock()
				delete(q.cancels, job.DeploymentID)
				q.mu.Unlock()
			}
			cancel()
			q.promote(serviceID)
		}()
		job.Run(ctx)
	}()
}

// promote marks the service free and starts the next queued job, if any.
func (q *Queue) promote(serviceID uuid.UUID) {
	q.mu.Lock()
	st := q.states[serviceID]
	if st == nil || len(st.pending) == 0 {
		if st != nil {
			st.running = false
		}
		q.mu.Unlock()
		return
	}
	next := st.pending[0]
	st.pending = st.pending[1:]
	q.mu.Unlock()
	q.start(serviceID, next)
}

// CancelState distinguishes what Cancel found.
type CancelState int

const (
	NotFound  CancelState = iota
	WasQueued             // removed before it started — caller marks DB cancelled
	WasActive             // ctx cancelled — the running job marks DB itself
)

// Cancel cancels a job by its deployment row id.
func (q *Queue) Cancel(serviceID, deploymentID uuid.UUID) CancelState {
	q.mu.Lock()
	if st := q.states[serviceID]; st != nil {
		for i, j := range st.pending {
			if j.DeploymentID == deploymentID {
				st.pending = append(st.pending[:i], st.pending[i+1:]...)
				q.mu.Unlock()
				return WasQueued
			}
		}
	}
	cancel, ok := q.cancels[deploymentID]
	q.mu.Unlock()
	if ok {
		cancel()
		return WasActive
	}
	return NotFound
}

// ServiceQueueState reports queue depth for one service.
type ServiceQueueState struct {
	ServiceID uuid.UUID `json:"service_id"`
	Running   bool      `json:"running"`
	Queued    int       `json:"queued"`
}

// Snapshot returns per-service queue depth for observability.
func (q *Queue) Snapshot() []ServiceQueueState {
	q.mu.Lock()
	defer q.mu.Unlock()
	out := make([]ServiceQueueState, 0, len(q.states))
	for id, st := range q.states {
		if !st.running && len(st.pending) == 0 {
			continue
		}
		out = append(out, ServiceQueueState{ServiceID: id, Running: st.running, Queued: len(st.pending)})
	}
	return out
}

// Do runs fn through the queue and waits for completion — for synchronous
// endpoints (redeploy) that still must not overlap an in-flight deployment.
// ctx bounds the wait, not the job; on timeout the job still runs to
// completion to avoid orphaned reconcile state.
func (q *Queue) Do(ctx context.Context, serviceID uuid.UUID, fn func(ctx context.Context)) {
	done := make(chan struct{})
	q.Enqueue(serviceID, Job{Run: func(jctx context.Context) {
		defer close(done)
		fn(jctx)
	}})
	select {
	case <-done:
	case <-ctx.Done():
	}
}
