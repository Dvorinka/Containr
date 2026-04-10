package authruntime

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"
)

type Config struct {
	Enabled        bool
	NodeBinary     string
	Entrypoint     string
	Port           int
	StartupTimeout time.Duration
}

type Manager struct {
	cmd       *exec.Cmd
	done      chan error
	closeOnce sync.Once
}

func Start(cfg Config) (*Manager, error) {
	if !cfg.Enabled {
		return nil, nil
	}

	nodeBinary := cfg.NodeBinary
	if nodeBinary == "" {
		nodeBinary = "node"
	}

	if _, err := exec.LookPath(nodeBinary); err != nil {
		return nil, fmt.Errorf("better auth node runtime not available: %w", err)
	}

	scriptPath, err := resolveEntrypoint(cfg.Entrypoint)
	if err != nil {
		return nil, err
	}

	cmd := exec.Command(nodeBinary, scriptPath)
	cmd.Env = os.Environ()
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	done := make(chan error, 1)
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start better auth runtime: %w", err)
	}

	manager := &Manager{
		cmd:  cmd,
		done: done,
	}

	go func() {
		done <- cmd.Wait()
	}()

	if err := waitForHealth(manager.done, cfg.healthURL(), cfg.StartupTimeout); err != nil {
		_ = manager.Close()
		return nil, err
	}

	return manager, nil
}

func (m *Manager) Close() error {
	if m == nil || m.cmd == nil || m.cmd.Process == nil {
		return nil
	}

	var closeErr error
	m.closeOnce.Do(func() {
		_ = m.cmd.Process.Signal(syscall.SIGTERM)

		select {
		case err := <-m.done:
			closeErr = normalizeWaitErr(err)
		case <-time.After(5 * time.Second):
			_ = m.cmd.Process.Kill()
			closeErr = normalizeWaitErr(<-m.done)
		}
	})

	return closeErr
}

func waitForHealth(done <-chan error, healthURL string, timeout time.Duration) error {
	if timeout <= 0 {
		timeout = 20 * time.Second
	}

	deadline := time.Now().Add(timeout)
	client := &http.Client{Timeout: time.Second}

	for time.Now().Before(deadline) {
		select {
		case err := <-done:
			return fmt.Errorf("better auth runtime exited before becoming healthy: %w", normalizeWaitErr(err))
		default:
		}

		request, err := http.NewRequestWithContext(context.Background(), http.MethodGet, healthURL, nil)
		if err == nil {
			response, reqErr := client.Do(request)
			if reqErr == nil {
				_ = response.Body.Close()
				if response.StatusCode == http.StatusOK {
					return nil
				}
			}
		}

		time.Sleep(250 * time.Millisecond)
	}

	return fmt.Errorf("timed out waiting for better auth runtime health at %s", healthURL)
}

func resolveEntrypoint(entrypoint string) (string, error) {
	if entrypoint == "" {
		entrypoint = "auth/src/server.js"
	}

	if filepath.IsAbs(entrypoint) {
		if _, err := os.Stat(entrypoint); err != nil {
			return "", fmt.Errorf("better auth entrypoint not found: %w", err)
		}
		return entrypoint, nil
	}

	cwd, err := os.Getwd()
	if err == nil {
		candidate := filepath.Join(cwd, entrypoint)
		if _, statErr := os.Stat(candidate); statErr == nil {
			return candidate, nil
		}
	}

	executablePath, err := os.Executable()
	if err == nil {
		candidate := filepath.Join(filepath.Dir(executablePath), entrypoint)
		if _, statErr := os.Stat(candidate); statErr == nil {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("better auth entrypoint %q not found", entrypoint)
}

func normalizeWaitErr(err error) error {
	if err == nil {
		return nil
	}

	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		if status, ok := exitErr.Sys().(syscall.WaitStatus); ok {
			if status.Signaled() && (status.Signal() == syscall.SIGTERM || status.Signal() == syscall.SIGKILL) {
				return nil
			}
		}
	}

	return err
}

func (c Config) healthURL() string {
	port := c.Port
	if port == 0 {
		port = 3001
	}
	return fmt.Sprintf("http://127.0.0.1:%d/health", port)
}
