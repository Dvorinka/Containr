package api

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"containr/internal/database"
	"containr/internal/docker"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// Interactive terminal: a WebSocket bridged to a `docker exec` pty in the
// service's container. Protocol is JSON text frames both ways:
//   client → server: {"type":"stdin","data":"..."} | {"type":"resize","cols":N,"rows":N}
//   server → client: {"type":"stdout","data":"..."} | {"type":"exit","code":N} | {"type":"error","message":"..."}
// Shell preference: $SHELL, then bash, then sh.

type terminalFrame struct {
	Type    string `json:"type"`
	Data    string `json:"data,omitempty"`
	Cols    uint   `json:"cols,omitempty"`
	Rows    uint   `json:"rows,omitempty"`
	Code    int    `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
}

func handleServiceTerminal(c *gin.Context) {
	db := c.MustGet("db").(*database.DB)
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "INVALID_ID", "invalid service id")
		return
	}
	projectID, found := serviceProjectID(db, serviceID)
	if !found {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "service not found")
		return
	}
	if _, allowed := projectManageAccess(c, db, projectID); !allowed {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "service not found")
		return
	}
	dockerClient, _ := c.Get("docker_client")
	client, ok := dockerClient.(*docker.Client)
	if !ok || client == nil {
		respondError(c, http.StatusServiceUnavailable, "DOCKER_UNAVAILABLE", "Docker is not configured")
		return
	}

	ctx := c.Request.Context()
	containers, err := client.ListContainersFiltered(ctx, filters.NewArgs(
		filters.Arg("label", "containr.service="+serviceID.String()),
	), false)
	if err != nil || len(containers) == 0 {
		respondError(c, http.StatusConflict, "NO_CONTAINER", "service has no running container")
		return
	}
	// Prefer a running container. With several matches, deterministically
	// pick the first `containr-<service>-<n>` replica by name — that is the
	// actual workload naming; auxiliary containers get ignored.
	target := ""
	sort.Slice(containers, func(i, j int) bool { return containers[i].Names[0] < containers[j].Names[0] })
	for _, ctr := range containers {
		if ctr.State == "running" && strings.HasPrefix(ctr.Names[0], "/containr-") {
			target = ctr.ID
			break
		}
	}
	if target == "" {
		for _, ctr := range containers {
			if ctr.State == "running" {
				target = ctr.ID
				break
			}
		}
	}
	if target == "" {
		target = containers[0].ID
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	send := func(f terminalFrame) bool {
		return conn.WriteJSON(f) == nil
	}

	// Pick a shell that actually exists — distroless images may have none.
	// `command -v` can't probe without a shell, so start each candidate and
	// watch for the OCI "no such file" failure.
	var stream types.HijackedResponse
	var execID string
	attached := false
	for _, candidate := range []string{"/bin/bash", "/bin/sh", "sh"} {
		exec, err := client.ExecCreate(ctx, target, docker.ExecConfig{
			Cmd:          []string{candidate},
			AttachStdin:  true,
			AttachStdout: true,
			AttachStderr: true,
			Tty:          true,
			Env:          []string{"TERM=xterm-256color", "COLORTERM=truecolor"},
		})
		if err != nil {
			continue
		}
		s, err := client.ExecAttach(ctx, exec.ID)
		if err != nil {
			continue
		}
		if execStartFailed(ctx, client, exec.ID, s) {
			s.Close()
			continue
		}
		stream, execID, attached = s, exec.ID, true
		break
	}
	if !attached {
		send(terminalFrame{Type: "error", Message: "no shell available in this container image"})
		return
	}
	defer stream.Close()

	// The client sends a resize frame with its real size right after
	// connecting; start at a sane default meanwhile.
	_ = client.ExecResize(ctx, execID, 80, 24)

	var wsWrite sync.Mutex
	writeJSON := func(f terminalFrame) {
		wsWrite.Lock()
		defer wsWrite.Unlock()
		_ = conn.WriteJSON(f)
	}

	// Container → client.
	go func() {
		buf := make([]byte, 8192)
		for {
			n, err := stream.Reader.Read(buf)
			if n > 0 {
				writeJSON(terminalFrame{Type: "stdout", Data: string(buf[:n])})
			}
			if err != nil {
				if err != io.EOF {
					log.Printf("terminal: exec stream ended: %v", err)
				}
				inspect, ierr := client.ExecInspect(context.Background(), execID)
				code := 0
				if ierr == nil {
					code = inspect.ExitCode
				}
				writeJSON(terminalFrame{Type: "exit", Code: code})
				_ = conn.WriteControl(websocket.CloseMessage,
					websocket.FormatCloseMessage(websocket.CloseNormalClosure, "session ended"),
					time.Now().Add(time.Second))
				return
			}
		}
	}()

	// Client → container.
	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			return
		}
		var f terminalFrame
		if err := json.Unmarshal(raw, &f); err != nil {
			continue
		}
		switch f.Type {
		case "stdin":
			if _, err := stream.Conn.Write([]byte(f.Data)); err != nil {
				return
			}
		case "resize":
			_ = client.ExecResize(ctx, execID, f.Cols, f.Rows)
		case "ping":
			writeJSON(terminalFrame{Type: "pong"})
		}
	}
}

// execStartFailed reports whether an attached exec failed to launch
// (missing binary → non-zero exit, not running). The OCI failure takes a
// moment to surface, so a short grace period elapses before judging.
func execStartFailed(ctx context.Context, client *docker.Client, execID string, _ types.HijackedResponse) bool {
	select {
	case <-ctx.Done():
		return true
	case <-time.After(500 * time.Millisecond):
	}
	inspect, err := client.ExecInspect(ctx, execID)
	if err != nil {
		return false
	}
	return !inspect.Running && inspect.ExitCode != 0
}
