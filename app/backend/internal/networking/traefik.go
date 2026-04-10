package networking

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type TraefikConfig struct {
	ConfigDir    string
	AcmeEmail    string
	AcmeCAServer string
	EntryPoint   string
	CertResolver string
	DomainSuffix string
}

type TraefikRouter struct {
	Name        string     `json:"name"`
	Rule        string     `json:"rule"`
	Service     string     `json:"service"`
	EntryPoint  string     `json:"entryPoints"`
	Middlewares []string   `json:"middlewares,omitempty"`
	TLS         *TLSConfig `json:"tls,omitempty"`
	Priority    int        `json:"priority,omitempty"`
}

type TraefikService struct {
	Name         string              `json:"name"`
	LoadBalancer *LoadBalancerConfig `json:"loadBalancer"`
	Weighted     *WeightedConfig     `json:"weighted,omitempty"`
	Mirroring    *MirroringConfig    `json:"mirroring,omitempty"`
}

type LoadBalancerConfig struct {
	Servers        []ServerConfig `json:"servers"`
	HealthCheck    *HealthCheck   `json:"healthCheck,omitempty"`
	Sticky         *StickyConfig  `json:"sticky,omitempty"`
	PassHostHeader bool           `json:"passHostHeader"`
}

type ServerConfig struct {
	URL    string `json:"url"`
	Scheme string `json:"scheme,omitempty"`
	Port   int    `json:"port,omitempty"`
}

type HealthCheck struct {
	Path            string `json:"path"`
	Interval        string `json:"interval"`
	Timeout         string `json:"timeout"`
	Hostname        string `json:"hostname,omitempty"`
	FollowRedirects bool   `json:"followRedirects,omitempty"`
}

type StickyConfig struct {
	Cookie *CookieConfig `json:"cookie,omitempty"`
}

type CookieConfig struct {
	Name     string `json:"name"`
	Secure   bool   `json:"secure"`
	HTTPOnly bool   `json:"httpOnly"`
	SameSite string `json:"sameSite,omitempty"`
}

type TLSConfig struct {
	CertResolver string   `json:"certResolver,omitempty"`
	Domains      []Domain `json:"domains,omitempty"`
}

type Domain struct {
	Main string   `json:"main"`
	SANS []string `json:"sans,omitempty"`
}

type WeightedConfig struct {
	Services []WeightedService `json:"services"`
}

type WeightedService struct {
	Name   string `json:"name"`
	Weight int    `json:"weight"`
}

type MirroringConfig struct {
	MainService string          `json:"mainService"`
	Mirrors     []MirrorService `json:"mirrors"`
}

type MirrorService struct {
	Name    string `json:"name"`
	Percent int    `json:"percent"`
}

type TraefikMiddleware struct {
	Name           string                `json:"name"`
	RateLimit      *RateLimitConfig      `json:"rateLimit,omitempty"`
	StripPrefix    *StripPrefixConfig    `json:"stripPrefix,omitempty"`
	AddPrefix      *AddPrefixConfig      `json:"addPrefix,omitempty"`
	Headers        *HeadersConfig        `json:"headers,omitempty"`
	RedirectRegex  *RedirectRegexConfig  `json:"redirectRegex,omitempty"`
	RedirectScheme *RedirectSchemeConfig `json:"redirectScheme,omitempty"`
	Compress       *CompressConfig       `json:"compress,omitempty"`
	Auth           *AuthConfig           `json:"basicAuth,omitempty"`
}

type RateLimitConfig struct {
	Average         int64            `json:"average"`
	Burst           int64            `json:"burst"`
	Period          time.Duration    `json:"period"`
	SourceCriterion *SourceCriterion `json:"sourceCriterion,omitempty"`
}

type SourceCriterion struct {
	IPStrategy *IPStrategy `json:"ipStrategy,omitempty"`
}

type IPStrategy struct {
	Depth       int      `json:"depth"`
	ExcludedIPs []string `json:"excludedIPs,omitempty"`
}

type StripPrefixConfig struct {
	Prefixes []string `json:"prefixes"`
}

type AddPrefixConfig struct {
	Prefix string `json:"prefix"`
}

type HeadersConfig struct {
	CustomRequestHeaders         map[string]string `json:"customRequestHeaders,omitempty"`
	CustomResponseHeaders        map[string]string `json:"customResponseHeaders,omitempty"`
	AccessControlAllowMethods    []string          `json:"accessControlAllowMethods,omitempty"`
	AccessControlAllowHeaders    []string          `json:"accessControlAllowHeaders,omitempty"`
	AccessControlAllowOriginList []string          `json:"accessControlAllowOriginList,omitempty"`
	SSLRedirect                  bool              `json:"sslRedirect,omitempty"`
	SSLProxyHeaders              map[string]string `json:"sslProxyHeaders,omitempty"`
}

type RedirectRegexConfig struct {
	Regex       string `json:"regex"`
	Replacement string `json:"replacement"`
	Permanent   bool   `json:"permanent"`
}

type RedirectSchemeConfig struct {
	Scheme    string `json:"scheme"`
	Port      string `json:"port,omitempty"`
	Permanent bool   `json:"permanent"`
}

type CompressConfig struct {
	MinResponseBodyBytes int `json:"minResponseBodyBytes"`
}

type AuthConfig struct {
	Users     []string `json:"users"`
	UsersFile string   `json:"usersFile,omitempty"`
}

type TraefikManager struct {
	config      *TraefikConfig
	sd          *ServiceDiscovery
	routers     map[string]*TraefikRouter
	services    map[string]*TraefikService
	middlewares map[string]*TraefikMiddleware
	mu          sync.RWMutex
}

func NewTraefikManager(config *TraefikConfig, sd *ServiceDiscovery) *TraefikManager {
	if config.EntryPoint == "" {
		config.EntryPoint = "websecure"
	}
	if config.CertResolver == "" {
		config.CertResolver = "letsencrypt"
	}
	if config.DomainSuffix == "" {
		config.DomainSuffix = "containr.local"
	}

	if config.ConfigDir != "" {
		os.MkdirAll(config.ConfigDir, 0755)
	}

	return &TraefikManager{
		config:      config,
		sd:          sd,
		routers:     make(map[string]*TraefikRouter),
		services:    make(map[string]*TraefikService),
		middlewares: make(map[string]*TraefikMiddleware),
	}
}

type ServiceRouteConfig struct {
	ServiceName   string
	ProjectID     string
	Port          int
	Domain        string
	PathPrefix    string
	EnableTLS     bool
	EnableAuth    bool
	AuthUsers     []string
	RateLimit     *RateLimitConfig
	HealthPath    string
	StickySession bool
	Priority      int
}

func (tm *TraefikManager) CreateServiceRoute(ctx context.Context, config *ServiceRouteConfig) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	serviceName := fmt.Sprintf("%s-%s", config.ProjectID, config.ServiceName)
	routerName := fmt.Sprintf("%s-router", serviceName)

	if config.Domain == "" {
		config.Domain = fmt.Sprintf("%s.%s", serviceName, tm.config.DomainSuffix)
	}

	var servers []ServerConfig
	if tm.sd != nil {
		instances, err := tm.sd.DiscoverService(ctx, config.ServiceName, config.ProjectID)
		if err == nil {
			for _, instance := range instances {
				servers = append(servers, ServerConfig{
					URL: fmt.Sprintf("http://%s:%d", instance.IPAddress, config.Port),
				})
			}
		}
	}

	if len(servers) == 0 {
		servers = append(servers, ServerConfig{
			URL: fmt.Sprintf("http://%s:%d", serviceName, config.Port),
		})
	}

	lbConfig := &LoadBalancerConfig{
		Servers:        servers,
		PassHostHeader: true,
	}

	if config.HealthPath != "" {
		lbConfig.HealthCheck = &HealthCheck{
			Path:     config.HealthPath,
			Interval: "30s",
			Timeout:  "5s",
		}
	}

	if config.StickySession {
		lbConfig.Sticky = &StickyConfig{
			Cookie: &CookieConfig{
				Name:     fmt.Sprintf("%s_sticky", serviceName),
				Secure:   true,
				HTTPOnly: true,
				SameSite: "None",
			},
		}
	}

	service := &TraefikService{
		Name:         serviceName,
		LoadBalancer: lbConfig,
	}
	tm.services[serviceName] = service

	rule := fmt.Sprintf("Host(`%s`)", config.Domain)
	if config.PathPrefix != "" {
		rule = fmt.Sprintf("%s && PathPrefix(`%s`)", rule, config.PathPrefix)
	}

	router := &TraefikRouter{
		Name:       routerName,
		Rule:       rule,
		Service:    serviceName,
		EntryPoint: tm.config.EntryPoint,
		Priority:   config.Priority,
	}

	var middlewares []string

	if config.RateLimit != nil {
		mwName := fmt.Sprintf("%s-ratelimit", serviceName)
		tm.middlewares[mwName] = &TraefikMiddleware{
			Name:      mwName,
			RateLimit: config.RateLimit,
		}
		middlewares = append(middlewares, mwName)
	}

	if config.EnableAuth && len(config.AuthUsers) > 0 {
		mwName := fmt.Sprintf("%s-auth", serviceName)
		tm.middlewares[mwName] = &TraefikMiddleware{
			Name: "auth",
			Auth: &AuthConfig{
				Users: config.AuthUsers,
			},
		}
		middlewares = append(middlewares, mwName)
	}

	if len(middlewares) > 0 {
		router.Middlewares = middlewares
	}

	if config.EnableTLS {
		router.TLS = &TLSConfig{
			CertResolver: tm.config.CertResolver,
			Domains: []Domain{
				{Main: config.Domain},
			},
		}
	}

	tm.routers[routerName] = router

	if tm.config.ConfigDir != "" {
		if err := tm.writeDynamicConfig(); err != nil {
			return fmt.Errorf("failed to write traefik config: %w", err)
		}
	}

	log.Printf("Created Traefik route for service %s at %s", serviceName, config.Domain)
	return nil
}

func (tm *TraefikManager) RemoveServiceRoute(ctx context.Context, serviceName, projectID string) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	serviceKey := fmt.Sprintf("%s-%s", projectID, serviceName)
	routerName := fmt.Sprintf("%s-router", serviceKey)

	delete(tm.services, serviceKey)
	delete(tm.routers, routerName)

	delete(tm.middlewares, fmt.Sprintf("%s-ratelimit", serviceKey))
	delete(tm.middlewares, fmt.Sprintf("%s-auth", serviceKey))

	if tm.config.ConfigDir != "" {
		if err := tm.writeDynamicConfig(); err != nil {
			return fmt.Errorf("failed to write traefik config: %w", err)
		}
	}

	log.Printf("Removed Traefik route for service %s", serviceKey)
	return nil
}

func (tm *TraefikManager) UpdateServiceServers(ctx context.Context, serviceName, projectID string) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	serviceKey := fmt.Sprintf("%s-%s", projectID, serviceName)
	service, exists := tm.services[serviceKey]
	if !exists {
		return fmt.Errorf("service not found: %s", serviceKey)
	}

	if tm.sd == nil {
		return nil
	}

	instances, err := tm.sd.DiscoverService(ctx, serviceName, projectID)
	if err != nil {
		return err
	}

	var servers []ServerConfig
	for _, instance := range instances {
		servers = append(servers, ServerConfig{
			URL: fmt.Sprintf("http://%s:%d", instance.IPAddress, instance.Port),
		})
	}

	if len(servers) > 0 {
		service.LoadBalancer.Servers = servers
	}

	if tm.config.ConfigDir != "" {
		if err := tm.writeDynamicConfig(); err != nil {
			return fmt.Errorf("failed to write traefik config: %w", err)
		}
	}

	return nil
}

func (tm *TraefikManager) writeDynamicConfig() error {
	configPath := filepath.Join(tm.config.ConfigDir, "dynamic.yaml")

	config := map[string]interface{}{
		"http": map[string]interface{}{
			"routers":     tm.routers,
			"services":    tm.services,
			"middlewares": tm.middlewares,
		},
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return ioutil.WriteFile(configPath, data, 0644)
}

func (tm *TraefikManager) GetRoutes() []*TraefikRouter {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	routes := make([]*TraefikRouter, 0, len(tm.routers))
	for _, router := range tm.routers {
		routes = append(routes, router)
	}
	return routes
}

func (tm *TraefikManager) GetServices() []*TraefikService {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	services := make([]*TraefikService, 0, len(tm.services))
	for _, service := range tm.services {
		services = append(services, service)
	}
	return services
}

func (tm *TraefikManager) GenerateDomain(serviceName, projectID string) string {
	return fmt.Sprintf("%s-%s.%s", projectID, serviceName, tm.config.DomainSuffix)
}
