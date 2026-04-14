package proxmox

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client represents a Proxmox API client
type Client struct {
	baseURL    string
	username   string
	password   string
	tokenID    string
	token      string
	httpClient *http.Client
	ticket     string
	csrfToken  string
}

// NewClient creates a new Proxmox API client
func NewClient(baseURL, username, password string) *Client {
	return &Client{
		baseURL:  strings.TrimSuffix(baseURL, "/"),
		username: username,
		password: password,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					InsecureSkipVerify: true, // Proxmox typically uses self-signed certs
				},
			},
		},
	}
}

// NewClientWithToken creates a new Proxmox API client using API token
func NewClientWithToken(baseURL, tokenID, token string) *Client {
	return &Client{
		baseURL:  strings.TrimSuffix(baseURL, "/"),
		tokenID:  tokenID,
		token:    token,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					InsecureSkipVerify: true,
				},
			},
		},
	}
}

// Login authenticates with Proxmox and stores session tokens
func (c *Client) Login() error {
	data := url.Values{}
	data.Set("username", c.username)
	data.Set("password", c.password)
	
	resp, err := c.httpClient.PostForm(c.baseURL+"/api2/json/access/ticket", data)
	if err != nil {
		return fmt.Errorf("failed to login: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("login failed with status: %s", resp.Status)
	}

	var result struct {
		Data struct {
			Ticket     string `json:"ticket"`
			CSRFPreventionToken string `json:"CSRFPreventionToken"`
			Username   string `json:"username"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("failed to decode login response: %w", err)
	}

	c.ticket = result.Data.Ticket
	c.csrfToken = result.Data.CSRFPreventionToken

	return nil
}

// makeRequest makes an authenticated request to Proxmox API
func (c *Client) makeRequest(method, path string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}

	// Use token authentication if available
	if c.tokenID != "" && c.token != "" {
		req.Header.Set("Authorization", "PVEAPIToken="+c.tokenID+"="+c.token)
	} else {
		// Use session ticket authentication
		if c.ticket == "" {
			if err := c.Login(); err != nil {
				return nil, fmt.Errorf("failed to authenticate: %w", err)
			}
		}
		req.AddCookie(&http.Cookie{
			Name:  "PVEAuthCookie",
			Value: c.ticket,
		})
	}

	req.Header.Set("Content-Type", "application/json")
	
	// Add CSRF token for state-changing requests
	if method != "GET" && method != "HEAD" && c.csrfToken != "" {
		req.Header.Set("CSRFPreventionToken", c.csrfToken)
	}

	return c.httpClient.Do(req)
}

// GetNodes retrieves all nodes in the Proxmox cluster
func (c *Client) GetNodes() ([]Node, error) {
	resp, err := c.makeRequest("GET", "/api2/json/nodes", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data []Node `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode nodes response: %w", err)
	}

	return result.Data, nil
}

// GetVMs retrieves all VMs/LXCs on a specific node
func (c *Client) GetVMs(node string) ([]VM, error) {
	resp, err := c.makeRequest("GET", fmt.Sprintf("/api2/json/nodes/%s/qemu", node), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data []VM `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode VMs response: %w", err)
	}

	return result.Data, nil
}

// GetContainers retrieves all LXC containers on a specific node
func (c *Client) GetContainers(node string) ([]Container, error) {
	resp, err := c.makeRequest("GET", fmt.Sprintf("/api2/json/nodes/%s/lxc", node), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data []Container `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode containers response: %w", err)
	}

	return result.Data, nil
}

// CreateVM creates a new VM on the specified node
func (c *Client) CreateVM(node string, config VMConfig) (string, error) {
	data := url.Values{}
	
	// Basic VM configuration
	data.Set("vmid", fmt.Sprintf("%d", config.VMID))
	data.Set("name", config.Name)
	data.Set("memory", fmt.Sprintf("%d", config.Memory))
	data.Set("cores", fmt.Sprintf("%d", config.Cores))
	
	if config.Template != "" {
		data.Set("template", config.Template)
	}
	
	if config.Storage != "" {
		data.Set("scsi0", fmt.Sprintf("%s:%d", config.Storage, config.DiskSize))
	}
	
	if config.NetworkBridge != "" {
		data.Set("net0", fmt.Sprintf("model=virtio,bridge=%s", config.NetworkBridge))
	}

	resp, err := c.makeRequest("POST", fmt.Sprintf("/api2/json/nodes/%s/qemu", node), strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("failed to create VM: %s - %s", resp.Status, string(body))
	}

	var result struct {
		Data string `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode create VM response: %w", err)
	}

	return result.Data, nil
}

// CreateContainer creates a new LXC container on the specified node
func (c *Client) CreateContainer(node string, config ContainerConfig) (string, error) {
	data := url.Values{}
	
	// Basic container configuration
	data.Set("vmid", fmt.Sprintf("%d", config.VMID))
	data.Set("hostname", config.Hostname)
	data.Set("memory", fmt.Sprintf("%d", config.Memory))
	data.Set("cores", fmt.Sprintf("%d", config.Cores))
	
	if config.Template != "" {
		data.Set("ostemplate", config.Template)
	}
	
	if config.Storage != "" {
		data.Set("rootfs", fmt.Sprintf("%s:%d", config.Storage, config.DiskSize))
	}
	
	if config.NetworkBridge != "" {
		data.Set("net0", fmt.Sprintf("name=eth0,bridge=%s", config.NetworkBridge))
	}

	resp, err := c.makeRequest("POST", fmt.Sprintf("/api2/json/nodes/%s/lxc", node), strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("failed to create container: %s - %s", resp.Status, string(body))
	}

	var result struct {
		Data string `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode create container response: %w", err)
	}

	return result.Data, nil
}

// StartVM starts a VM
func (c *Client) StartVM(node string, vmid int) error {
	resp, err := c.makeRequest("POST", fmt.Sprintf("/api2/json/nodes/%s/qemu/%d/status/start", node, vmid), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to start VM: %s", resp.Status)
	}

	return nil
}

// StopVM stops a VM
func (c *Client) StopVM(node string, vmid int) error {
	resp, err := c.makeRequest("POST", fmt.Sprintf("/api2/json/nodes/%s/qemu/%d/status/stop", node, vmid), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to stop VM: %s", resp.Status)
	}

	return nil
}

// DeleteVM deletes a VM
func (c *Client) DeleteVM(node string, vmid int) error {
	resp, err := c.makeRequest("DELETE", fmt.Sprintf("/api2/json/nodes/%s/qemu/%d", node, vmid), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to delete VM: %s", resp.Status)
	}

	return nil
}

// GetVMStatus retrieves the status of a VM
func (c *Client) GetVMStatus(node string, vmid int) (*VMStatus, error) {
	resp, err := c.makeRequest("GET", fmt.Sprintf("/api2/json/nodes/%s/qemu/%d/status/current", node, vmid), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data VMStatus `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode VM status response: %w", err)
	}

	return &result.Data, nil
}
