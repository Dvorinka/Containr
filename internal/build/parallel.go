package build

import (
	"context"
	"fmt"
	"sync"
	"time"

	"containr/internal/types"
)

// ParallelBuilder handles parallel build execution
type ParallelBuilder struct {
	buildManager *BuildManager
	cacheManager *CacheManager
	maxWorkers   int
}

// BuildJob represents a build job in the queue
type BuildJob struct {
	ID        string
	Request   *types.BuildRequest
	Result    chan *BuildResult
	Priority  int
	CreatedAt time.Time
}

// BuildResult represents the result of a build job
type BuildResult struct {
	Success  bool
	Response *types.BuildResponse
	Error    error
	Duration time.Duration
	CacheHit bool
	BuildID  string
}

// WorkerPool manages a pool of build workers
type WorkerPool struct {
	jobs         chan *BuildJob
	workers      []*Worker
	wg           sync.WaitGroup
	quit         chan bool
	maxWorkers   int
	buildManager *BuildManager
	cacheManager *CacheManager
}

// Worker represents a build worker
type Worker struct {
	id           int
	jobChan      chan *BuildJob
	quit         chan bool
	buildManager *BuildManager
	cacheManager *CacheManager
}

// NewParallelBuilder creates a new parallel build manager
func NewParallelBuilder(buildManager *BuildManager, cacheManager *CacheManager, maxWorkers int) *ParallelBuilder {
	return &ParallelBuilder{
		buildManager: buildManager,
		cacheManager: cacheManager,
		maxWorkers:   maxWorkers,
	}
}

// BuildWithCache attempts to build using cache first
func (pb *ParallelBuilder) BuildWithCache(ctx context.Context, req *types.BuildRequest) (*BuildResult, error) {
	startTime := time.Now()

	// Generate cache key
	cacheKey, err := pb.cacheManager.GenerateCacheKey(ctx, req)
	if err != nil {
		return &BuildResult{
			Success:  false,
			Error:    fmt.Errorf("failed to generate cache key: %w", err),
			Duration: time.Since(startTime),
			CacheHit: false,
		}, err
	}

	// Try to find cached result
	if cachedEntry, err := pb.cacheManager.LookupCache(ctx, cacheKey); err == nil {
		return &BuildResult{
			Success: true,
			Response: &types.BuildResponse{
				ImageName: cachedEntry.ImageName,
				ImageTag:  req.ImageTag,
				Size:      cachedEntry.Size,
				Digest:    cachedEntry.Hash,
			},
			Duration: time.Since(startTime),
			CacheHit: true,
		}, nil
	}

	// No cache hit, proceed with build
	response, err := pb.buildManager.Build(ctx, req)
	duration := time.Since(startTime)

	if err != nil {
		return &BuildResult{
			Success:  false,
			Error:    err,
			Duration: duration,
			CacheHit: false,
		}, err
	}

	// Store in cache for future builds
	metadata := map[string]string{
		"build_type": req.BuildType,
		"runtime":    cacheKey.Runtime,
		"build_time": duration.String(),
	}

	if storeErr := pb.cacheManager.StoreCache(ctx, cacheKey, response.ImageName, metadata); storeErr != nil {
		fmt.Printf("Warning: failed to store build cache: %v\n", storeErr)
	}

	return &BuildResult{
		Success:  true,
		Response: response,
		Duration: duration,
		CacheHit: false,
	}, nil
}

// NewWorkerPool creates a new worker pool for parallel builds
func NewWorkerPool(maxWorkers int, buildManager *BuildManager, cacheManager *CacheManager) *WorkerPool {
	return &WorkerPool{
		jobs:         make(chan *BuildJob, 100), // Buffered channel
		workers:      make([]*Worker, maxWorkers),
		quit:         make(chan bool),
		maxWorkers:   maxWorkers,
		buildManager: buildManager,
		cacheManager: cacheManager,
	}
}

// Start starts the worker pool
func (wp *WorkerPool) Start() {
	for i := 0; i < wp.maxWorkers; i++ {
		worker := &Worker{
			id:           i,
			jobChan:      wp.jobs,
			quit:         wp.quit,
			buildManager: wp.buildManager,
			cacheManager: wp.cacheManager,
		}
		wp.workers[i] = worker
		wp.wg.Add(1)
		go worker.start(&wp.wg)
	}
}

// Stop stops the worker pool
func (wp *WorkerPool) Stop() {
	close(wp.quit)
	wp.wg.Wait()
}

// SubmitJob submits a build job to the worker pool
func (wp *WorkerPool) SubmitJob(ctx context.Context, job *BuildJob) error {
	select {
	case wp.jobs <- job:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// BuildParallel executes builds in parallel using the worker pool
func (pb *ParallelBuilder) BuildParallel(ctx context.Context, requests []*types.BuildRequest) ([]*BuildResult, error) {
	if len(requests) == 0 {
		return nil, fmt.Errorf("no build requests provided")
	}

	// Create worker pool
	workerPool := NewWorkerPool(pb.maxWorkers, pb.buildManager, pb.cacheManager)
	workerPool.Start()
	defer workerPool.Stop()

	// Create jobs
	jobs := make([]*BuildJob, len(requests))
	results := make([]*BuildResult, len(requests))

	for i, req := range requests {
		job := &BuildJob{
			ID:        fmt.Sprintf("build-%d-%d", time.Now().UnixNano(), i),
			Request:   req,
			Result:    make(chan *BuildResult, 1),
			Priority:  0,
			CreatedAt: time.Now(),
		}
		jobs[i] = job

		// Submit job
		if err := workerPool.SubmitJob(ctx, job); err != nil {
			return nil, fmt.Errorf("failed to submit job %s: %w", job.ID, err)
		}
	}

	// Collect results
	var wg sync.WaitGroup
	for i, job := range jobs {
		wg.Add(1)
		go func(index int, buildJob *BuildJob) {
			defer wg.Done()
			select {
			case result := <-buildJob.Result:
				results[index] = result
			case <-ctx.Done():
				results[index] = &BuildResult{
					Success: false,
					Error:   ctx.Err(),
					BuildID: buildJob.ID,
				}
			}
		}(i, job)
	}
	wg.Wait()

	return results, nil
}

// BuildBatch executes a batch of builds with optimized scheduling
func (pb *ParallelBuilder) BuildBatch(ctx context.Context, requests []*types.BuildRequest) (*BatchBuildResult, error) {
	if len(requests) == 0 {
		return nil, fmt.Errorf("no build requests provided")
	}

	startTime := time.Now()

	// Group builds by cache key potential for optimization
	cacheGroups := pb.groupByCachePotential(ctx, requests)

	// Execute builds in optimized order
	var allResults []*BuildResult
	var totalCacheHits int

	for _, group := range cacheGroups {
		groupResults, err := pb.BuildParallel(ctx, group.Requests)
		if err != nil {
			return nil, err
		}

		allResults = append(allResults, groupResults...)

		// Count cache hits
		for _, result := range groupResults {
			if result.CacheHit {
				totalCacheHits++
			}
		}
	}

	// Map results back to original order
	resultMap := make(map[string]*BuildResult)
	for _, result := range allResults {
		if result.Response != nil {
			resultMap[result.Response.ImageName] = result
		}
	}

	// Create final results array in original order
	finalResults := make([]*BuildResult, len(requests))
	for i, req := range requests {
		imageName := fmt.Sprintf("%s:%s", req.ImageName, req.ImageTag)
		if result, exists := resultMap[imageName]; exists {
			finalResults[i] = result
		} else {
			finalResults[i] = &BuildResult{
				Success: false,
				Error:   fmt.Errorf("build result not found for %s", imageName),
			}
		}
	}

	return &BatchBuildResult{
		Results:       finalResults,
		TotalBuilds:   len(requests),
		Successful:    pb.countSuccessful(finalResults),
		Failed:        pb.countFailed(finalResults),
		CacheHits:     totalCacheHits,
		TotalDuration: time.Since(startTime),
		AverageTime:   time.Since(startTime) / time.Duration(len(requests)),
	}, nil
}

// BatchBuildResult represents the result of a batch build
type BatchBuildResult struct {
	Results       []*BuildResult
	TotalBuilds   int
	Successful    int
	Failed        int
	CacheHits     int
	TotalDuration time.Duration
	AverageTime   time.Duration
}

// CacheGroup represents a group of builds with similar cache potential
type CacheGroup struct {
	Name     string
	Requests []*types.BuildRequest
	Priority int
}

// groupByCachePotential groups builds by their cache optimization potential
func (pb *ParallelBuilder) groupByCachePotential(ctx context.Context, requests []*types.BuildRequest) []CacheGroup {
	groups := make(map[string][]*types.BuildRequest)

	for _, req := range requests {
		cacheKey, err := pb.cacheManager.GenerateCacheKey(ctx, req)
		if err != nil {
			// Put in uncached group if we can't generate a key
			groups["uncached"] = append(groups["uncached"], req)
			continue
		}

		// Group by runtime and similar characteristics
		groupKey := fmt.Sprintf("%s-%s", cacheKey.Runtime, pb.hashBuildArgs(cacheKey.BuildArgs))
		groups[groupKey] = append(groups[groupKey], req)
	}

	// Convert to sorted groups with priorities
	var sortedGroups []CacheGroup
	for name, reqs := range groups {
		priority := 0
		if name == "uncached" {
			priority = 999 // Lowest priority
		} else if len(reqs) > 1 {
			priority = 1 // High priority for groups with multiple builds
		} else {
			priority = 2 // Medium priority for single builds
		}

		sortedGroups = append(sortedGroups, CacheGroup{
			Name:     name,
			Requests: reqs,
			Priority: priority,
		})
	}

	// Sort by priority (lower number = higher priority)
	for i := 0; i < len(sortedGroups); i++ {
		for j := i + 1; j < len(sortedGroups); j++ {
			if sortedGroups[i].Priority > sortedGroups[j].Priority {
				sortedGroups[i], sortedGroups[j] = sortedGroups[j], sortedGroups[i]
			}
		}
	}

	return sortedGroups
}

// hashBuildArgs creates a hash of build arguments for grouping
func (pb *ParallelBuilder) hashBuildArgs(args map[string]string) string {
	if len(args) == 0 {
		return "no-args"
	}

	// Simple hash for grouping - in production, use proper hashing
	result := ""
	for k, v := range args {
		result += k + "=" + v + ";"
	}
	return result
}

func (pb *ParallelBuilder) countSuccessful(results []*BuildResult) int {
	count := 0
	for _, result := range results {
		if result.Success {
			count++
		}
	}
	return count
}

func (pb *ParallelBuilder) countFailed(results []*BuildResult) int {
	count := 0
	for _, result := range results {
		if !result.Success {
			count++
		}
	}
	return count
}

// Worker methods

func (w *Worker) start(wg *sync.WaitGroup) {
	defer wg.Done()

	for {
		select {
		case job := <-w.jobChan:
			// Process the job
			result := w.processJob(job)
			job.Result <- result
		case <-w.quit:
			return
		}
	}
}

func (w *Worker) processJob(job *BuildJob) *BuildResult {
	ctx := context.Background()

	// Use the parallel builder's cache-aware build method
	pb := &ParallelBuilder{
		buildManager: w.buildManager,
		cacheManager: w.cacheManager,
	}

	result, err := pb.BuildWithCache(ctx, job.Request)
	if err != nil {
		return &BuildResult{
			Success: false,
			Error:   err,
			BuildID: job.ID,
		}
	}

	result.BuildID = job.ID
	return result
}
