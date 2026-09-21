package api

import (
	"context"
	"database/sql"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/docker"

	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/registry"
	"github.com/gin-gonic/gin"
)

// Platform setting keys. Values stored in app_settings take precedence over
// environment variables; env remains the fallback for optional overrides.
const (
	settingSignupEnabled         = "signup_enabled"
	settingCloudflareTunnelToken = "cloudflare_tunnel_token"

	cloudflaredContainerName = "containr-cloudflared"
	cloudflaredImage         = "cloudflare/cloudflared:latest"
)

// settingValue resolves a setting: app_settings row first, env fallback,
// then the caller's default.
func settingValue(db *database.DB, key, envKey, fallback string) string {
	if db != nil && db.DB != nil {
		var value string
		err := db.QueryRow(`SELECT value FROM app_settings WHERE key = $1`, key).Scan(&value)
		if err == nil {
			return value
		}
		if err != sql.ErrNoRows {
			log.Printf("Failed to read setting %s: %v", key, err)
		}
	}
	if envKey != "" {
		if value := strings.TrimSpace(os.Getenv(envKey)); value != "" {
			return value
		}
	}
	return fallback
}

func setSetting(db *database.DB, key, value string, secret bool) error {
	_, err := db.Exec(`
		INSERT INTO app_settings (key, value, is_secret, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (key) DO UPDATE
		SET value = EXCLUDED.value, is_secret = EXCLUDED.is_secret, updated_at = NOW()
	`, key, value, secret)
	return err
}

func deleteSetting(db *database.DB, key string) error {
	_, err := db.Exec(`DELETE FROM app_settings WHERE key = $1`, key)
	return err
}

// signupEnabled controls whether public registration stays open after the
// first account exists. Defaults to closed; the platform owner can reopen it
// in Settings or via SIGNUP_ENABLED=true.
func signupEnabled(db *database.DB) bool {
	return strings.EqualFold(settingValue(db, settingSignupEnabled, "SIGNUP_ENABLED", "false"), "true")
}

func isAdminUser(db *database.DB, userID string) bool {
	var isAdmin bool
	if err := db.QueryRow(`SELECT is_admin FROM users WHERE id = $1`, userID).Scan(&isAdmin); err != nil {
		return false
	}
	return isAdmin
}

func requireAdmin(c *gin.Context) (*database.DB, bool) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return nil, false
	}
	db, _ := c.Get("db")
	database, _ := db.(*database.DB)
	if database == nil || database.DB == nil || !isAdminUser(database, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return nil, false
	}
	return database, true
}

type cloudflareTunnelStatus struct {
	TokenSet  bool   `json:"token_set"`
	Source    string `json:"source"` // "app" | "env" | "none"
	Container string `json:"container"`
}

func handleGetSettings(c *gin.Context) {
	db, ok := requireAdmin(c)
	if !ok {
		return
	}

	dockerClient, _ := c.Get("docker_client")
	client, _ := dockerClient.(*docker.Client)

	c.JSON(http.StatusOK, gin.H{
		"signup_enabled":    signupEnabled(db),
		"cloudflare_tunnel": cloudflareTunnelState(c.Request.Context(), db, client),
	})
}

func handleUpdateSettings(c *gin.Context) {
	db, ok := requireAdmin(c)
	if !ok {
		return
	}

	var req struct {
		SignupEnabled         *bool   `json:"signup_enabled"`
		CloudflareTunnelToken *string `json:"cloudflare_tunnel_token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.SignupEnabled != nil {
		value := "false"
		if *req.SignupEnabled {
			value = "true"
		}
		if err := setSetting(db, settingSignupEnabled, value, false); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update signup setting"})
			return
		}
	}

	if req.CloudflareTunnelToken != nil {
		token := strings.TrimSpace(*req.CloudflareTunnelToken)
		if token == "" {
			if err := deleteSetting(db, settingCloudflareTunnelToken); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear tunnel token"})
				return
			}
		} else if err := setSetting(db, settingCloudflareTunnelToken, token, true); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save tunnel token"})
			return
		}

		if dockerClient, exists := c.Get("docker_client"); exists {
			if client, ok := dockerClient.(*docker.Client); ok && client != nil {
				go applyCloudflaredTunnel(client, token)
			}
		}
	}

	handleGetSettings(c)
}

// resolvedTunnelToken prefers the in-app value and falls back to the env.
func resolvedTunnelToken(db *database.DB) (string, string) {
	if db != nil && db.DB != nil {
		var value string
		if err := db.QueryRow(`SELECT value FROM app_settings WHERE key = $1`, settingCloudflareTunnelToken).Scan(&value); err == nil && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value), "app"
		}
	}
	if value := strings.TrimSpace(os.Getenv("CLOUDFLARED_TOKEN")); value != "" && value != "your_cloudflare_tunnel_token_here" {
		return value, "env"
	}
	return "", "none"
}

func cloudflareTunnelState(ctx context.Context, db *database.DB, client *docker.Client) cloudflareTunnelStatus {
	token, source := resolvedTunnelToken(db)
	state := cloudflareTunnelStatus{TokenSet: token != "", Source: source, Container: "missing"}

	if client == nil {
		state.Container = "unavailable"
		return state
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	container, err := findCloudflaredContainer(ctx, client)
	if err != nil || container == "" {
		return state
	}
	if inspect, err := client.GetContainer(ctx, container); err == nil && inspect.State != nil {
		state.Container = inspect.State.Status
	}
	return state
}

// syncManagedContainers reconciles containers the platform manages from
// settings - currently only the optional Cloudflare Tunnel sidecar.
func syncManagedContainers(client *docker.Client, db *database.DB) {
	token, _ := resolvedTunnelToken(db)
	if token == "" {
		return
	}
	go applyCloudflaredTunnel(client, token)
}

func findCloudflaredContainer(ctx context.Context, client *docker.Client) (string, error) {
	containers, err := client.ListContainers(ctx, true)
	if err != nil {
		return "", err
	}
	for _, item := range containers {
		for _, name := range item.Names {
			if strings.TrimPrefix(name, "/") == cloudflaredContainerName {
				return item.ID, nil
			}
		}
	}
	return "", nil
}

// applyCloudflaredTunnel ensures a cloudflared container mirrors the stored
// token: created/recreated when set, removed when cleared. It joins the same
// networks as the backend so tunnel targets can use compose service names.
func applyCloudflaredTunnel(client *docker.Client, token string) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	if existing, err := findCloudflaredContainer(ctx, client); err == nil && existing != "" {
		if err := client.RemoveContainer(ctx, existing, true); err != nil {
			log.Printf("Failed to remove existing cloudflared container: %v", err)
			return
		}
	}

	if token == "" {
		return
	}

	if reader, err := client.PullImage(ctx, cloudflaredImage, registry.AuthConfig{}); err == nil {
		_, _ = io.Copy(io.Discard, reader)
		_ = reader.Close()
	} else {
		log.Printf("Failed to pull %s: %v", cloudflaredImage, err)
	}

	networks, err := backendNetworks(ctx, client)
	if err != nil {
		log.Printf("Failed to resolve backend networks for cloudflared: %v", err)
		return
	}

	id, err := client.CreateContainer(ctx, docker.ContainerConfig{
		Name:          cloudflaredContainerName,
		Image:         cloudflaredImage,
		Cmd:           []string{"tunnel", "--no-autoupdate", "run", "--token", token},
		RestartPolicy: "unless-stopped",
		Labels:        map[string]string{"containr.managed": "cloudflared"},
		Networks:      networks,
	})
	if err != nil {
		log.Printf("Failed to create cloudflared container: %v", err)
		return
	}
	if err := client.StartContainer(ctx, id); err != nil {
		log.Printf("Failed to start cloudflared container: %v", err)
	}
}

// backendNetworks returns the networks this backend container sits on, so the
// managed cloudflared container can reach the frontend/backend by name.
func backendNetworks(ctx context.Context, client *docker.Client) (map[string]*network.EndpointSettings, error) {
	hostname, err := os.Hostname()
	if err != nil {
		return nil, err
	}
	self, err := client.GetContainer(ctx, hostname)
	if err != nil {
		return nil, err
	}

	networks := map[string]*network.EndpointSettings{}
	for name := range self.NetworkSettings.Networks {
		networks[name] = &network.EndpointSettings{}
	}
	if len(networks) == 0 {
		return nil, sql.ErrNoRows
	}
	return networks, nil
}
