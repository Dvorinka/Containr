package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type agentConfig struct {
	APIURL   string
	Token    string
	Name     string
	Hostname string
	IP       string
	Port     int
	Interval time.Duration
}

type capabilities struct {
	ContainerRuntimes      []string `json:"container_runtimes"`
	SupportedArchitectures []string `json:"supported_architectures"`
	MaxContainers          int      `json:"max_containers"`
	StorageDriver          string   `json:"storage_driver"`
	NetworkPlugins         []string `json:"network_plugins"`
	Features               []string `json:"features"`
}

type nodeResources struct {
	CPU     cpuResources     `json:"cpu"`
	Memory  memoryResources  `json:"memory"`
	Storage storageResources `json:"storage"`
	Network networkResources `json:"network"`
}

type cpuResources struct {
	Cores      int     `json:"cores"`
	Allocation float64 `json:"allocation"`
	Usage      float64 `json:"usage"`
}

type memoryResources struct {
	Total     int `json:"total"`
	Allocated int `json:"allocated"`
	Used      int `json:"used"`
	Available int `json:"available"`
}

type storageResources struct {
	Total     int `json:"total"`
	Allocated int `json:"allocated"`
	Used      int `json:"used"`
	Available int `json:"available"`
}

type networkResources struct {
	Interfaces []networkInterface `json:"interfaces"`
	Bandwidth  bandwidthInfo      `json:"bandwidth"`
}

type networkInterface struct {
	Name       string `json:"name"`
	IPAddress  string `json:"ip_address"`
	MACAddress string `json:"mac_address"`
	Speed      int    `json:"speed"`
	Status     string `json:"status"`
}

type bandwidthInfo struct {
	Inbound  int `json:"inbound"`
	Outbound int `json:"outbound"`
}

type systemLoad struct {
	Load1M  float64 `json:"load_1m"`
	Load5M  float64 `json:"load_5m"`
	Load15M float64 `json:"load_15m"`
}

type command struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Payload   map[string]interface{} `json:"payload"`
	CreatedAt string                 `json:"created_at"`
}

type commandList struct {
	Commands []command `json:"commands"`
}

type registerResponse struct {
	AgentID string `json:"agent_id"`
	Status  string `json:"status"`
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatal(err)
	}

	client := &http.Client{Timeout: 20 * time.Second}
	agentID, err := register(context.Background(), client, cfg)
	if err != nil {
		log.Fatalf("register agent: %v", err)
	}

	log.Printf("containr agent connected: id=%s api=%s", agentID, cfg.APIURL)
	ticker := time.NewTicker(cfg.Interval)
	defer ticker.Stop()

	for {
		if err := sendHeartbeat(context.Background(), client, cfg, agentID); err != nil {
			log.Printf("heartbeat failed: %v", err)
		}
		if err := processCommands(context.Background(), client, cfg, agentID); err != nil {
			log.Printf("command poll failed: %v", err)
		}
		<-ticker.C
	}
}

func loadConfig() (agentConfig, error) {
	hostname, _ := os.Hostname()
	apiURL := strings.TrimRight(firstEnv("CONTAINR_API_URL", "http://localhost:8082"), "/")
	apiURL = strings.TrimSuffix(strings.TrimSuffix(apiURL, "/api/v1"), "/api")
	token := strings.TrimSpace(os.Getenv("CONTAINR_AGENT_AUTH_TOKEN"))
	if token == "" {
		token = strings.TrimSpace(os.Getenv("CONTAINR_AGENT_TOKEN"))
	}
	if token == "" {
		return agentConfig{}, errors.New("set CONTAINR_AGENT_AUTH_TOKEN")
	}

	intervalSeconds, _ := strconv.Atoi(firstEnv("CONTAINR_AGENT_INTERVAL_SECONDS", "15"))
	if intervalSeconds < 5 {
		intervalSeconds = 5
	}
	port, _ := strconv.Atoi(firstEnv("CONTAINR_AGENT_PORT", "9090"))

	return agentConfig{
		APIURL:   apiURL,
		Token:    token,
		Name:     firstEnv("CONTAINR_AGENT_NAME", hostname),
		Hostname: firstEnv("CONTAINR_AGENT_HOSTNAME", hostname),
		IP:       firstEnv("CONTAINR_AGENT_IP", detectOutboundIP()),
		Port:     port,
		Interval: time.Duration(intervalSeconds) * time.Second,
	}, nil
}

func register(ctx context.Context, client *http.Client, cfg agentConfig) (string, error) {
	payload := map[string]interface{}{
		"name":         cfg.Name,
		"hostname":     cfg.Hostname,
		"ip_address":   cfg.IP,
		"port":         cfg.Port,
		"capabilities": detectCapabilities(),
	}
	var response registerResponse
	if err := postJSON(ctx, client, cfg, "/api/agents/register", payload, &response); err != nil {
		return "", err
	}
	if response.AgentID == "" {
		return "", errors.New("register response missing agent_id")
	}
	return response.AgentID, nil
}

func sendHeartbeat(ctx context.Context, client *http.Client, cfg agentConfig, agentID string) error {
	resources := collectResources(cfg.IP)
	payload := map[string]interface{}{
		"node_agent_id":   agentID,
		"timestamp":       time.Now().UTC().Format(time.RFC3339),
		"status":          agentStatus(),
		"resources":       resources,
		"container_count": dockerContainerCount(),
		"system_load":     readSystemLoad(),
		"uptime":          readSystemUptime(),
		"version":         firstEnv("CONTAINR_AGENT_VERSION", "dev"),
	}
	return postJSON(ctx, client, cfg, "/api/agents/heartbeat", payload, nil)
}

func processCommands(ctx context.Context, client *http.Client, cfg agentConfig, agentID string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/api/agents/%s/commands", cfg.APIURL, agentID), nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-Containr-Agent-Token", cfg.Token)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("command poll status %d", resp.StatusCode)
	}

	var list commandList
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return err
	}
	for _, item := range list.Commands {
		result, runErr := executeCommand(item)
		status := "completed"
		errText := ""
		if runErr != nil {
			status = "failed"
			errText = runErr.Error()
		}
		payload := map[string]string{
			"status": status,
			"result": result,
			"error":  errText,
		}
		path := fmt.Sprintf("/api/agents/%s/commands/%s/result", agentID, item.ID)
		if err := postJSON(ctx, client, cfg, path, payload, nil); err != nil {
			log.Printf("report command result failed: command=%s err=%v", item.ID, err)
		}
	}
	return nil
}

func executeCommand(item command) (string, error) {
	switch item.Type {
	case "create_container":
		return createContainer(item.Payload)
	case "start_container":
		return runDocker("start", commandTarget(item.Payload))
	case "stop_container":
		return runDocker("stop", commandTarget(item.Payload))
	case "restart_container":
		return runDocker("restart", commandTarget(item.Payload))
	case "remove_container":
		return runDocker("rm", "-f", commandTarget(item.Payload))
	default:
		return "", fmt.Errorf("unsupported command type %q", item.Type)
	}
}

func createContainer(payload map[string]interface{}) (string, error) {
	container, ok := payload["container"].(map[string]interface{})
	if !ok {
		return "", errors.New("missing container payload")
	}

	name := stringValue(container["name"])
	image := stringValue(container["image"])
	if name == "" || image == "" {
		return "", errors.New("container name and image are required")
	}

	args := []string{"run", "-d", "--name", name, "--restart", "unless-stopped"}
	if env, ok := container["environment"].(map[string]interface{}); ok {
		for key, value := range env {
			args = append(args, "-e", fmt.Sprintf("%s=%v", key, value))
		}
	}
	if ports, ok := container["ports"].([]interface{}); ok {
		for _, rawPort := range ports {
			port, ok := rawPort.(map[string]interface{})
			if !ok || !boolValue(port["published"]) {
				continue
			}
			hostPort := intValue(port["host_port"])
			containerPort := intValue(port["container_port"])
			protocol := firstString(stringValue(port["protocol"]), "tcp")
			if hostPort > 0 && containerPort > 0 {
				args = append(args, "-p", fmt.Sprintf("%d:%d/%s", hostPort, containerPort, protocol))
			}
		}
	}
	if volumes, ok := container["volumes"].([]interface{}); ok {
		for _, rawVolume := range volumes {
			volume, ok := rawVolume.(map[string]interface{})
			if !ok {
				continue
			}
			source := stringValue(volume["source"])
			target := stringValue(volume["target"])
			if source != "" && target != "" {
				mount := source + ":" + target
				if boolValue(volume["read_only"]) {
					mount += ":ro"
				}
				args = append(args, "-v", mount)
			}
		}
	}
	args = append(args, image)
	return runDocker(args...)
}

func commandTarget(payload map[string]interface{}) string {
	for _, key := range []string{"container_name", "docker_name", "name", "container_id"} {
		if value := stringValue(payload[key]); value != "" {
			return value
		}
	}
	return ""
}

func postJSON(ctx context.Context, client *http.Client, cfg agentConfig, path string, payload interface{}, out interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.APIURL+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Containr-Agent-Token", cfg.Token)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("request %s failed with status %d", path, resp.StatusCode)
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func detectCapabilities() capabilities {
	runtimes := []string{}
	if dockerAvailable() {
		runtimes = append(runtimes, "docker")
	}
	return capabilities{
		ContainerRuntimes:      runtimes,
		SupportedArchitectures: []string{runtime.GOARCH},
		MaxContainers:          100,
		StorageDriver:          dockerStorageDriver(),
		NetworkPlugins:         []string{"bridge"},
		Features:               []string{"host-metrics", "heartbeats", "command-poll", "docker-lifecycle"},
	}
}

func collectResources(ip string) nodeResources {
	mem := readMemory()
	storage := readStorage("/")
	return nodeResources{
		CPU: cpuResources{
			Cores:      runtime.NumCPU(),
			Allocation: 0,
			Usage:      readCPULoadPercent(),
		},
		Memory:  mem,
		Storage: storage,
		Network: networkResources{
			Interfaces: []networkInterface{{
				Name:      "primary",
				IPAddress: ip,
				Speed:     0,
				Status:    "up",
			}},
			Bandwidth: bandwidthInfo{},
		},
	}
}

func readMemory() memoryResources {
	values := map[string]int{}
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return memoryResources{}
	}
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		value, err := strconv.Atoi(fields[1])
		if err == nil {
			values[strings.TrimSuffix(fields[0], ":")] = value * 1024
		}
	}
	total := values["MemTotal"]
	available := values["MemAvailable"]
	used := total - available
	if used < 0 {
		used = 0
	}
	return memoryResources{Total: total, Used: used, Available: available}
}

func readStorage(path string) storageResources {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return storageResources{}
	}
	total := int(stat.Blocks * uint64(stat.Bsize))
	available := int(stat.Bavail * uint64(stat.Bsize))
	used := total - available
	if used < 0 {
		used = 0
	}
	return storageResources{Total: total, Used: used, Available: available}
}

func readSystemLoad() systemLoad {
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return systemLoad{}
	}
	fields := strings.Fields(string(data))
	if len(fields) < 3 {
		return systemLoad{}
	}
	load1, _ := strconv.ParseFloat(fields[0], 64)
	load5, _ := strconv.ParseFloat(fields[1], 64)
	load15, _ := strconv.ParseFloat(fields[2], 64)
	return systemLoad{Load1M: load1, Load5M: load5, Load15M: load15}
}

func readSystemUptime() int64 {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(data))
	if len(fields) == 0 {
		return 0
	}
	uptime, _ := strconv.ParseFloat(fields[0], 64)
	return int64(uptime)
}

func readCPULoadPercent() float64 {
	load := readSystemLoad()
	cores := runtime.NumCPU()
	if cores == 0 {
		return 0
	}
	percent := load.Load1M / float64(cores) * 100
	if percent < 0 {
		return 0
	}
	if percent > 100 {
		return 100
	}
	return percent
}

func runDocker(args ...string) (string, error) {
	if len(args) == 0 || args[len(args)-1] == "" {
		return "", errors.New("missing docker target")
	}
	cmd := exec.Command("docker", args...)
	output, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(output)), err
}

func dockerAvailable() bool {
	_, err := exec.LookPath("docker")
	if err != nil {
		return false
	}
	cmd := exec.Command("docker", "info", "--format", "{{.ServerVersion}}")
	return cmd.Run() == nil
}

func dockerStorageDriver() string {
	out, err := exec.Command("docker", "info", "--format", "{{.Driver}}").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func dockerContainerCount() int {
	out, err := exec.Command("docker", "ps", "-q").Output()
	if err != nil {
		return 0
	}
	count := 0
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if strings.TrimSpace(line) != "" {
			count++
		}
	}
	return count
}

func agentStatus() string {
	if dockerAvailable() {
		return "online"
	}
	return "degraded"
}

func detectOutboundIP() string {
	conn, err := net.DialTimeout("udp", "8.8.8.8:80", 2*time.Second)
	if err != nil {
		return "127.0.0.1"
	}
	defer conn.Close()
	if addr, ok := conn.LocalAddr().(*net.UDPAddr); ok {
		return addr.IP.String()
	}
	return "127.0.0.1"
}

func firstEnv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func firstString(value, fallback string) string {
	if value != "" {
		return value
	}
	return fallback
}

func stringValue(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	default:
		return ""
	}
}

func intValue(value interface{}) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case json.Number:
		out, _ := typed.Int64()
		return int(out)
	default:
		return 0
	}
}

func boolValue(value interface{}) bool {
	typed, _ := value.(bool)
	return typed
}
