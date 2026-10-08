package commands

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

// LogsCmd prints service runtime logs.
var LogsCmd = &cobra.Command{
	Use:   "logs <service-id>",
	Short: "Print or follow service logs",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		follow, _ := cmd.Flags().GetBool("follow")
		tail, _ := cmd.Flags().GetInt("tail")
		path := fmt.Sprintf("/services/%s/logs?tail=%d", args[0], tail)
		if follow {
			return streamSSE(c, path+"&follow=true")
		}
		data, err := c.Do("GET", path, nil)
		if err != nil {
			return err
		}
		return printLogEntries(data)
	},
}

// ExecCmd runs a one-off command inside a service container.
var ExecCmd = &cobra.Command{
	Use:   "exec <service-id> -- <command>",
	Short: "Run a one-off command in the service container (30s ceiling)",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		command := strings.Join(args[1:], " ")
		if command == "" {
			return &APIError{Message: "no command given — usage: containr exec <id> -- <command>", ExitCode: ExitValidation}
		}
		data, err := c.Do("POST", "/services/"+args[0]+"/exec", map[string]string{"command": command})
		if err != nil {
			return err
		}
		if JSONMode() {
			PrintRaw(data)
			return nil
		}
		resp, _ := unwrapObject(data)
		fmt.Print(str(resp, "output", "stdout"))
		if code := str(resp, "exit_code", "exitCode"); code != "-" && code != "0" {
			return &APIError{Message: fmt.Sprintf("command exited with %s", code), ExitCode: ExitError}
		}
		return nil
	},
}

type logEntry struct {
	Timestamp string `json:"timestamp"`
	Message   string `json:"message"`
	Stream    string `json:"stream"`
}

// printLogEntries decodes the {"logs":[...]} envelope both log endpoints use.
func printLogEntries(data []byte) error {
	var payload struct {
		Logs    []logEntry `json:"logs"`
		Message string     `json:"message"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		PrintRaw(data)
		return nil
	}
	if JSONMode() {
		PrintRaw(data)
		return nil
	}
	for _, e := range payload.Logs {
		fmt.Println(e.Message)
	}
	if len(payload.Logs) == 0 && payload.Message != "" {
		fmt.Fprintln(os.Stderr, payload.Message)
	}
	return nil
}

// runDeploymentLogs prints persisted build+runtime logs for a deployment.
func runDeploymentLogs(cmd *cobra.Command, args []string) error {
	c, err := client()
	if err != nil {
		return err
	}
	logType, _ := cmd.Flags().GetString("type")
	data, err := c.Do("GET", "/deployments/"+args[0]+"/logs?type="+logType, nil)
	if err != nil {
		return err
	}
	if JSONMode() {
		PrintRaw(data)
		return nil
	}
	var payload struct {
		BuildLog   string `json:"build_log"`
		RuntimeLog string `json:"runtime_log"`
	}
	if json.Unmarshal(data, &payload) == nil && (payload.BuildLog != "" || payload.RuntimeLog != "") {
		if payload.BuildLog != "" {
			fmt.Print(payload.BuildLog)
		}
		if payload.RuntimeLog != "" {
			fmt.Print(payload.RuntimeLog)
		}
		return nil
	}
	return printLogEntries(data)
}

// streamSSE consumes a text/event-stream response and prints each
// `data:` line's message field until the server closes the stream.
func streamSSE(c *Client, path string) error {
	req, err := http.NewRequest("GET", c.BaseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Accept", "text/event-stream")
	hc := c.HTTPClient
	if hc == nil {
		hc = http.DefaultClient
	}
	resp, err := hc.Do(req)
	if err != nil {
		return &APIError{Message: fmt.Sprintf("cannot reach %s: %v", c.BaseURL, err), ExitCode: ExitUnavailable}
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return &APIError{Status: resp.StatusCode, ExitCode: exitCodeFor(resp.StatusCode)}
	}
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 64<<10), 4<<20)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		var e logEntry
		if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data:")), &e); err == nil {
			fmt.Println(e.Message)
		} else {
			fmt.Println(strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		}
	}
	return scanner.Err()
}

func init() {
	LogsCmd.Flags().BoolP("follow", "f", false, "stream new log lines (SSE)")
	LogsCmd.Flags().Int("tail", 100, "number of lines to return")
	deploymentsLogsCmd.Flags().String("type", "all", "log type: all|build|runtime")
}
