package networking

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/miekg/dns"
)

// DNSServer provides internal DNS resolution for services
type DNSServer struct {
	server           *dns.Server
	serviceDiscovery *ServiceDiscovery
	domain           string
	addresses        []string
	mu               sync.RWMutex
}

// DNSConfig holds DNS server configuration
type DNSConfig struct {
	Domain    string   `json:"domain"`
	Addresses []string `json:"addresses"`
	Port      int      `json:"port"`
	Upstream  []string `json:"upstream"`
}

// NewDNSServer creates a new DNS server
func NewDNSServer(config DNSConfig, serviceDiscovery *ServiceDiscovery) *DNSServer {
	return &DNSServer{
		domain:           config.Domain,
		addresses:        config.Addresses,
		serviceDiscovery: serviceDiscovery,
	}
}

// Start starts the DNS server
func (d *DNSServer) Start(ctx context.Context) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	// Create DNS handler
	handler := dns.NewServeMux()
	handler.HandleFunc(d.domain, d.handleServiceRequest)
	handler.HandleFunc("in-addr.arpa.", d.handleReverseRequest)

	// Create server
	d.server = &dns.Server{
		Addr:    ":53",
		Net:     "udp",
		Handler: handler,
	}

	// Start server in goroutine
	go func() {
		if err := d.server.ListenAndServe(); err != nil {
			fmt.Printf("DNS server error: %v\n", err)
		}
	}()

	return nil
}

// Stop stops the DNS server
func (d *DNSServer) Stop() error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.server != nil {
		return d.server.Shutdown()
	}
	return nil
}

// handleServiceRequest handles DNS requests for services
func (d *DNSServer) handleServiceRequest(w dns.ResponseWriter, r *dns.Msg) {
	msg := new(dns.Msg)
	msg.SetReply(r)
	msg.Authoritative = true

	for _, question := range r.Question {
		if question.Qtype == dns.TypeA {
			// Extract service name from query
			serviceName := d.extractServiceName(question.Name)
			if serviceName == "" {
				continue
			}

			// Resolve service
			ips, err := d.serviceDiscovery.ResolveService(context.Background(), serviceName, "")
			if err != nil {
				continue
			}

			// Create A records
			for _, ip := range ips {
				rr, err := dns.NewRR(fmt.Sprintf("%s 30 IN A %s", question.Name, ip))
				if err == nil {
					msg.Answer = append(msg.Answer, rr)
				}
			}
		} else if question.Qtype == dns.TypeSRV {
			// Handle SRV requests for service discovery
			serviceName := d.extractServiceName(question.Name)
			if serviceName == "" {
				continue
			}

			// Get service instances
			instances, err := d.serviceDiscovery.DiscoverService(context.Background(), serviceName, "")
			if err != nil {
				continue
			}

			// Create SRV records
			for _, instance := range instances {
				target := fmt.Sprintf("%s.%s", instance.ServiceName, d.domain)
				srv := fmt.Sprintf("%s 30 IN SRV 10 5 %d %s", question.Name, instance.Port, target)
				rr, err := dns.NewRR(srv)
				if err == nil {
					msg.Answer = append(msg.Answer, rr)
				}
			}
		}
	}

	w.WriteMsg(msg)
}

// handleReverseRequest handles reverse DNS lookups
func (d *DNSServer) handleReverseRequest(w dns.ResponseWriter, r *dns.Msg) {
	msg := new(dns.Msg)
	msg.SetReply(r)
	msg.Authoritative = true

	for _, question := range r.Question {
		if question.Qtype == dns.TypePTR {
			// Extract IP from reverse query
			ip := d.extractIPFromReverse(question.Name)
			if ip == "" {
				continue
			}

			// Find service by IP
			var serviceName string
			for _, instance := range d.serviceDiscovery.services {
				if instance.IPAddress == ip {
					serviceName = instance.ServiceName
					break
				}
			}

			if serviceName != "" {
				ptr := fmt.Sprintf("%s 30 IN PTR %s.%s", question.Name, serviceName, d.domain)
				rr, err := dns.NewRR(ptr)
				if err == nil {
					msg.Answer = append(msg.Answer, rr)
				}
			}
		}
	}

	w.WriteMsg(msg)
}

// extractServiceName extracts service name from DNS query
func (d *DNSServer) extractServiceName(query string) string {
	// Remove domain suffix
	if strings.HasSuffix(query, d.domain) {
		name := strings.TrimSuffix(query, d.domain)
		name = strings.Trim(name, ".")
		return name
	}
	return ""
}

// extractIPFromReverse extracts IP from reverse DNS query
func (d *DNSServer) extractIPFromReverse(reverse string) string {
	// Handle IPv4 reverse lookup
	if strings.HasSuffix(reverse, "in-addr.arpa.") {
		parts := strings.Split(reverse, ".")
		if len(parts) >= 4 {
			// Reverse the first 4 parts to get IP
			ip := fmt.Sprintf("%s.%s.%s.%s", parts[3], parts[2], parts[1], parts[0])
			return ip
		}
	}
	return ""
}

// DNSClient provides DNS resolution utilities
type DNSClient struct {
	servers []string
	timeout time.Duration
}

// NewDNSClient creates a new DNS client
func NewDNSClient(servers []string) *DNSClient {
	return &DNSClient{
		servers: servers,
		timeout: 5 * time.Second,
	}
}

// ResolveService resolves a service name using DNS
func (c *DNSClient) ResolveService(serviceName, domain string) ([]string, error) {
	fqdn := fmt.Sprintf("%s.%s", serviceName, domain)

	// Create DNS message
	msg := new(dns.Msg)
	msg.SetQuestion(dns.Fqdn(fqdn), dns.TypeA)
	msg.RecursionDesired = true

	// Try each DNS server
	for _, server := range c.servers {
		client := &dns.Client{Timeout: c.timeout}
		response, _, err := client.Exchange(msg, server+":53")
		if err != nil {
			continue
		}

		if len(response.Answer) > 0 {
			var ips []string
			for _, answer := range response.Answer {
				if a, ok := answer.(*dns.A); ok {
					ips = append(ips, a.A.String())
				}
			}
			return ips, nil
		}
	}

	return nil, fmt.Errorf("failed to resolve service: %s", serviceName)
}

// ResolveSRV resolves SRV records for a service
func (c *DNSClient) ResolveSRV(serviceName, domain string) ([]*SRVRecord, error) {
	fqdn := fmt.Sprintf("_%s._tcp.%s", serviceName, domain)

	// Create DNS message
	msg := new(dns.Msg)
	msg.SetQuestion(dns.Fqdn(fqdn), dns.TypeSRV)
	msg.RecursionDesired = true

	// Try each DNS server
	for _, server := range c.servers {
		client := &dns.Client{Timeout: c.timeout}
		response, _, err := client.Exchange(msg, server+":53")
		if err != nil {
			continue
		}

		if len(response.Answer) > 0 {
			var records []*SRVRecord
			for _, answer := range response.Answer {
				if srv, ok := answer.(*dns.SRV); ok {
					record := &SRVRecord{
						Priority: srv.Priority,
						Weight:   srv.Weight,
						Port:     srv.Port,
						Target:   srv.Target,
					}
					records = append(records, record)
				}
			}
			return records, nil
		}
	}

	return nil, fmt.Errorf("failed to resolve SRV record for service: %s", serviceName)
}

// SRVRecord represents an SRV record
type SRVRecord struct {
	Priority uint16
	Weight   uint16
	Port     uint16
	Target   string
}

// NetworkUtils provides network utility functions
type NetworkUtils struct{}

// NewNetworkUtils creates a new network utils instance
func NewNetworkUtils() *NetworkUtils {
	return &NetworkUtils{}
}

// GetLocalIP returns the local IP address
func (nu *NetworkUtils) GetLocalIP() (string, error) {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "", err
	}

	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String(), nil
			}
		}
	}

	return "", fmt.Errorf("no local IP address found")
}

// IsPortOpen checks if a port is open on a host
func (nu *NetworkUtils) IsPortOpen(host string, port int, timeout time.Duration) bool {
	address := net.JoinHostPort(host, strconv.Itoa(port))
	conn, err := net.DialTimeout("tcp", address, timeout)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// WaitForPort waits for a port to become available
func (nu *NetworkUtils) WaitForPort(host string, port int, timeout time.Duration) error {
	start := time.Now()
	for time.Since(start) < timeout {
		if nu.IsPortOpen(host, port, 1*time.Second) {
			return nil
		}
		time.Sleep(1 * time.Second)
	}
	return fmt.Errorf("port %d on %s did not become available within %v", port, host, timeout)
}

// GenerateSubnet generates a subnet for a project
func (nu *NetworkUtils) GenerateSubnet(projectID string) string {
	// Simple hash-based subnet generation
	hash := 0
	for _, c := range projectID {
		hash = hash*31 + int(c)
	}
	if hash < 0 {
		hash = -hash
	}

	// Generate 10.x.y.0/24 subnet
	octet2 := (hash % 254) + 1
	octet3 := ((hash / 254) % 254) + 1
	return fmt.Sprintf("10.%d.%d.0/24", octet2, octet3)
}

// GetAvailablePort finds an available port in a range
func (nu *NetworkUtils) GetAvailablePort(start, end int) (int, error) {
	for port := start; port <= end; port++ {
		listener, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
		if err == nil {
			listener.Close()
			return port, nil
		}
	}
	return 0, fmt.Errorf("no available ports in range %d-%d", start, end)
}
