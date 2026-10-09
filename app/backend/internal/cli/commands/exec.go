package commands

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

// ShellCmd opens an interactive shell inside a service's running container.
var ShellCmd = &cobra.Command{
	Use:   "shell <service-id>",
	Short: "Interactive shell inside the service container",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		serviceID := args[0]
		cli, err := client()
		if err != nil {
			return err
		}
		base := strings.TrimRight(cli.BaseURL, "/")
		wsURL := strings.Replace(base, "http", "ws", 1) + "/services/" + serviceID + "/terminal"

		header := http.Header{}
		header.Set("Authorization", "Bearer "+cli.Token)
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
		if err != nil {
			return fmt.Errorf("terminal: %w", err)
		}
		defer conn.Close()

		fd := int(os.Stdin.Fd())
		raw := term.IsTerminal(fd)
		var oldState *term.State
		if raw {
			oldState, err = term.MakeRaw(fd)
			if err == nil {
				defer term.Restore(fd, oldState)
			}
			sendSize := func() {
				if w, h, err := term.GetSize(fd); err == nil {
					_ = conn.WriteJSON(map[string]interface{}{"type": "resize", "cols": w, "rows": h})
				}
			}
			sendSize()
			defer watchResize(sendSize)()
		}

		done := make(chan struct{})
		// stdin → ws
		go func() {
			buf := make([]byte, 4096)
			for {
				n, err := os.Stdin.Read(buf)
				if n > 0 {
					if werr := conn.WriteJSON(map[string]interface{}{
						"type": "stdin", "data": string(buf[:n]),
					}); werr != nil {
						return
					}
				}
				if err != nil {
					return
				}
			}
		}()
		// ws → stdout
		go func() {
			defer close(done)
			for {
				var frame struct {
					Type    string `json:"type"`
					Data    string `json:"data"`
					Code    int    `json:"code"`
					Message string `json:"message"`
				}
				if err := conn.ReadJSON(&frame); err != nil {
					return
				}
				switch frame.Type {
				case "stdout":
					_, _ = os.Stdout.WriteString(frame.Data)
				case "exit":
					fmt.Fprintf(os.Stderr, "\r\n[session ended — exit %d]\r\n", frame.Code)
					return
				case "error":
					fmt.Fprintf(os.Stderr, "\r\nerror: %s\r\n", frame.Message)
					return
				}
			}
		}()

		select {
		case <-done:
		case <-time.After(24 * time.Hour):
		}
		return nil
	},
}
