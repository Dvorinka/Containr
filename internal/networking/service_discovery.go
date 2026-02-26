package networking

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"sync"
	"time"

	"containr/internal/deployment"
)

// ServiceDiscovery handles service registration, discovery, and DNS resolution
type ServiceDiscovery struct {
	services     map[string]*ServiceInstance
	instances    map[string][]*ServiceInstance
	mu           sync.RWMutex
	scheduler    *deployment.Scheduler
	dnsDomain    string
	loadBalancer *LoadBalancer
}

// ServiceInstance represents a running instance of a service
type ServiceInstance struct {
	ID          string            `json:"id"`
	ServiceID   string            `json:"service_id"`
	ServiceName string            `json:"service_name"`
	ProjectID   string            `json:"project_id"`
	NodeID      string            `json:"node_id"`
	IPAddress   string            `json:"ip_address"`
	Port        int               `json:"port"`
	Status      string            `json:"status"`
	Health      HealthStatus      `json:"health"`
	Labels      map[string]string `json:"labels"`
	Metadata    map[string]string `json:"metadata"`
	CreatedAt   time.Time         `json:"created_at"`
	LastSeen    time.Time         `json:"last_seen"`
}

// HealthStatus represents the health status of a service instance
type HealthStatus struct {
	Status       string    `json:"status"` // healthy, unhealthy, unknown
	LastCheck    time.Time `json:"last_check"`
	CheckCount   int       `json:"check_count"`
	FailureCount int       `json:"failure_count"`
	Message      string    `json:"message"`
}

// ServiceRegistry represents the service registry
type ServiceRegistry struct {
	Name      string             `json:"name"`
	Namespace string             `json:"namespace"`
	Instances []*ServiceInstance `json:"instances"`
	Selector  map[string]string  `json:"selector"`
	Ports     []ServicePort      `json:"ports"`
	CreatedAt time.Time          `json:"created_at"`
	UpdatedAt time.Time          `json:"updated_at"`
}

// ServicePort represents a service port configuration
type ServicePort struct {
	Name       string `json:"name"`
	Port       int    `json:"port"`
	TargetPort int    `json:"target_port"`
	Protocol   string `json:"protocol"`
}

// LoadBalancer handles load balancing across service instances
type LoadBalancer struct {
	strategy LoadBalancingStrategy
	mu       sync.RWMutex
}

type LoadBalancingStrategy string

const (
	StrategyRoundRobin       LoadBalancingStrategy = "round_robin"
	StrategyLeastConnections LoadBalancingStrategy = "least_connections"
	StrategyIPHash           LoadBalancingStrategy = "ip_hash"
	StrategyRandom           LoadBalancingStrategy = "random"
)

// DNSRecord represents a DNS record for a service
type DNSRecord struct {
	Name     string   `json:"name"`
	Type     string   `json:"type"` // A, SRV, CNAME
	TTL      int      `json:"ttl"`
	Records  []string `json:"records"`  // IP addresses or hostnames
	Priority int      `json:"priority"` // For SRV records
	Weight   int      `json:"weight"`   // For SRV records
	Port     int      `json:"port"`     // For SRV records
}

// NewServiceDiscovery creates a new service discovery instance
func NewServiceDiscovery(scheduler *deployment.Scheduler, dnsDomain string) *ServiceDiscovery {
	return &ServiceDiscovery{
		services:     make(map[string]*ServiceInstance),
		instances:    make(map[string][]*ServiceInstance),
		scheduler:    scheduler,
		dnsDomain:    dnsDomain,
		loadBalancer: NewLoadBalancer(StrategyRoundRobin),
	}
}

// RegisterService registers a new service instance
func (sd *ServiceDiscovery) RegisterService(ctx context.Context, instance *ServiceInstance) error {
	sd.mu.Lock()
	defer sd.mu.Unlock()

	// Validate instance
	if instance.ServiceName == "" || instance.IPAddress == "" {
		return fmt.Errorf("service name and IP address are required")
	}

	// Set defaults
	if instance.Status == "" {
		instance.Status = "starting"
	}
	if instance.Health.Status == "" {
		instance.Health.Status = "unknown"
	}
	instance.CreatedAt = time.Now()
	instance.LastSeen = time.Now()

	// Store instance
	sd.services[instance.ID] = instance

	// Add to service instances map
	serviceKey := sd.getServiceKey(instance.ServiceName, instance.ProjectID)
	sd.instances[serviceKey] = append(sd.instances[serviceKey], instance)

	// Start health checking
	go sd.startHealthCheck(instance)

	return nil
}

// UnregisterService removes a service instance
func (sd *ServiceDiscovery) UnregisterService(ctx context.Context, instanceID string) error {
	sd.mu.Lock()
	defer sd.mu.Unlock()

	instance, exists := sd.services[instanceID]
	if !exists {
		return fmt.Errorf("service instance not found: %s", instanceID)
	}

	// Remove from services map
	delete(sd.services, instanceID)

	// Remove from instances map
	serviceKey := sd.getServiceKey(instance.ServiceName, instance.ProjectID)
	instances := sd.instances[serviceKey]
	for i, inst := range instances {
		if inst.ID == instanceID {
			sd.instances[serviceKey] = append(instances[:i], instances[i+1:]...)
			break
		}
	}

	return nil
}

// DiscoverService finds service instances by name and project
func (sd *ServiceDiscovery) DiscoverService(ctx context.Context, serviceName, projectID string) ([]*ServiceInstance, error) {
	sd.mu.RLock()
	defer sd.mu.RUnlock()

	serviceKey := sd.getServiceKey(serviceName, projectID)
	instances, exists := sd.instances[serviceKey]
	if !exists {
		return nil, fmt.Errorf("service not found: %s", serviceName)
	}

	// Filter healthy instances only
	var healthyInstances []*ServiceInstance
	for _, instance := range instances {
		if instance.Health.Status == "healthy" && instance.Status == "running" {
			healthyInstances = append(healthyInstances, instance)
		}
	}

	if len(healthyInstances) == 0 {
		return nil, fmt.Errorf("no healthy instances found for service: %s", serviceName)
	}

	return healthyInstances, nil
}

// GetServiceEndpoints returns all endpoints for a service
func (sd *ServiceDiscovery) GetServiceEndpoints(ctx context.Context, serviceName, projectID string) ([]string, error) {
	instances, err := sd.DiscoverService(ctx, serviceName, projectID)
	if err != nil {
		return nil, err
	}

	var endpoints []string
	for _, instance := range instances {
		endpoint := fmt.Sprintf("%s:%d", instance.IPAddress, instance.Port)
		endpoints = append(endpoints, endpoint)
	}

	return endpoints, nil
}

// ResolveService resolves a service name to IP addresses (DNS-like functionality)
func (sd *ServiceDiscovery) ResolveService(ctx context.Context, serviceName, projectID string) ([]string, error) {
	instances, err := sd.DiscoverService(ctx, serviceName, projectID)
	if err != nil {
		return nil, err
	}

	var ips []string
	for _, instance := range instances {
		ips = append(ips, instance.IPAddress)
	}

	return ips, nil
}

// GetDNSRecords generates DNS records for all services
func (sd *ServiceDiscovery) GetDNSRecords(ctx context.Context) ([]*DNSRecord, error) {
	sd.mu.RLock()
	defer sd.mu.RUnlock()

	var records []*DNSRecord

	// Group instances by service
	serviceGroups := make(map[string][]*ServiceInstance)
	for _, instance := range sd.services {
		if instance.Health.Status == "healthy" && instance.Status == "running" {
			serviceGroups[instance.ServiceName] = append(serviceGroups[instance.ServiceName], instance)
		}
	}

	// Create A records for each service
	for serviceName, instances := range serviceGroups {
		var ips []string
		for _, instance := range instances {
			ips = append(ips, instance.IPAddress)
		}

		if len(ips) > 0 {
			// Create A record
			fqdn := fmt.Sprintf("%s.%s", serviceName, sd.dnsDomain)
			record := &DNSRecord{
				Name:    fqdn,
				Type:    "A",
				TTL:     30,
				Records: ips,
			}
			records = append(records, record)

			// Create SRV record for services with ports
			if len(instances) > 0 && instances[0].Port > 0 {
				srvRecord := &DNSRecord{
					Name:     fmt.Sprintf("_%s._tcp.%s", serviceName, sd.dnsDomain),
					Type:     "SRV",
					TTL:      30,
					Port:     instances[0].Port,
					Records:  []string{fqdn},
					Priority: 10,
					Weight:   5,
				}
				records = append(records, srvRecord)
			}
		}
	}

	return records, nil
}

// UpdateServiceHealth updates the health status of a service instance
func (sd *ServiceDiscovery) UpdateServiceHealth(ctx context.Context, instanceID string, health HealthStatus) error {
	sd.mu.Lock()
	defer sd.mu.Unlock()

	instance, exists := sd.services[instanceID]
	if !exists {
		return fmt.Errorf("service instance not found: %s", instanceID)
	}

	instance.Health = health
	instance.LastSeen = time.Now()

	return nil
}

// GetServiceStats returns statistics about services
func (sd *ServiceDiscovery) GetServiceStats(ctx context.Context) map[string]interface{} {
	sd.mu.RLock()
	defer sd.mu.RUnlock()

	totalServices := len(sd.instances)
	healthyInstances := 0
	unhealthyInstances := 0

	for _, instance := range sd.services {
		if instance.Health.Status == "healthy" {
			healthyInstances++
		} else if instance.Health.Status == "unhealthy" {
			unhealthyInstances++
		}
	}

	return map[string]interface{}{
		"total_services":      totalServices,
		"healthy_instances":   healthyInstances,
		"unhealthy_instances": unhealthyInstances,
		"dns_domain":          sd.dnsDomain,
		"load_balancer":       string(sd.loadBalancer.strategy),
	}
}

// getServiceKey creates a unique key for a service
func (sd *ServiceDiscovery) getServiceKey(serviceName, projectID string) string {
	return fmt.Sprintf("%s:%s", projectID, serviceName)
}

// startHealthCheck starts periodic health checking for a service instance
func (sd *ServiceDiscovery) startHealthCheck(instance *ServiceInstance) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			healthy := sd.checkInstanceHealth(ctx, instance)

			health := HealthStatus{
				LastCheck: time.Now(),
			}

			if healthy {
				health.Status = "healthy"
				health.CheckCount++
				health.FailureCount = 0
				health.Message = "Health check passed"
			} else {
				health.Status = "unhealthy"
				health.CheckCount++
				health.FailureCount++
				health.Message = "Health check failed"
			}

			sd.UpdateServiceHealth(ctx, instance.ID, health)
			cancel()
		}
	}
}

// checkInstanceHealth performs a health check on a service instance
func (sd *ServiceDiscovery) checkInstanceHealth(ctx context.Context, instance *ServiceInstance) bool {
	// Simple TCP connection check
	if instance.Port > 0 {
		address := net.JoinHostPort(instance.IPAddress, strconv.Itoa(instance.Port))
		conn, err := net.DialTimeout("tcp", address, 5*time.Second)
		if err != nil {
			return false
		}
		conn.Close()
		return true
	}

	// If no port specified, assume healthy
	return true
}

// NewLoadBalancer creates a new load balancer
func NewLoadBalancer(strategy LoadBalancingStrategy) *LoadBalancer {
	return &LoadBalancer{
		strategy: strategy,
	}
}

// SelectInstance selects an instance using the configured load balancing strategy
func (lb *LoadBalancer) SelectInstance(instances []*ServiceInstance, clientIP string) *ServiceInstance {
	lb.mu.RLock()
	defer lb.mu.RUnlock()

	if len(instances) == 0 {
		return nil
	}

	switch lb.strategy {
	case StrategyRoundRobin:
		return lb.roundRobinSelect(instances)
	case StrategyLeastConnections:
		return lb.leastConnectionsSelect(instances)
	case StrategyIPHash:
		return lb.ipHashSelect(instances, clientIP)
	case StrategyRandom:
		return lb.randomSelect(instances)
	default:
		return instances[0]
	}
}

// roundRobinSelect implements round-robin load balancing
func (lb *LoadBalancer) roundRobinSelect(instances []*ServiceInstance) *ServiceInstance {
	// Simple implementation - in production, maintain round-robin state
	return instances[0]
}

// leastConnectionsSelect selects instance with least connections
func (lb *LoadBalancer) leastConnectionsSelect(instances []*ServiceInstance) *ServiceInstance {
	var selected *ServiceInstance
	minConnections := int(^uint(0) >> 1) // Max int

	for _, instance := range instances {
		// In a real implementation, track actual connections
		connections := 0 // Placeholder
		if connections < minConnections {
			selected = instance
			minConnections = connections
		}
	}

	return selected
}

// ipHashSelect selects instance based on client IP hash
func (lb *LoadBalancer) ipHashSelect(instances []*ServiceInstance, clientIP string) *ServiceInstance {
	if clientIP == "" {
		return instances[0]
	}

	hash := 0
	for _, c := range clientIP {
		hash = hash*31 + int(c)
	}

	if hash < 0 {
		hash = -hash
	}

	index := hash % len(instances)
	return instances[index]
}

// randomSelect selects a random instance
func (lb *LoadBalancer) randomSelect(instances []*ServiceInstance) *ServiceInstance {
	// Simple implementation - in production, use proper random
	return instances[0]
}
