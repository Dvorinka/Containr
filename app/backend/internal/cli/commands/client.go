package commands

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Exit codes — stable for scripting and agent use.
const (
	ExitOK          = 0
	ExitError       = 1
	ExitAuth        = 2
	ExitNotFound    = 3
	ExitValidation  = 4
	ExitUnavailable = 5
)

// APIError is a non-2xx response from the Containr API. Code carries the
// stable exit code so `main` can map errors to exit statuses.
type APIError struct {
	Status   int
	Message  string
	ExitCode int
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return fmt.Sprintf("request failed with status %d", e.Status)
}

func exitCodeFor(status int) int {
	switch status {
	case http.StatusUnauthorized, http.StatusForbidden:
		return ExitAuth
	case http.StatusNotFound:
		return ExitNotFound
	case http.StatusBadRequest, http.StatusConflict, http.StatusUnprocessableEntity:
		return ExitValidation
	default:
		return ExitError
	}
}

// Client is a thin authenticated HTTP client for the Containr API. All CLI
// commands go through it — no command builds its own request.
type Client struct {
	BaseURL    string
	Token      string
	HTTPClient *http.Client
}

// NewClient resolves the active profile (flag > env > current_profile) and
// returns a client ready to call the API. Call RequireAuth() for commands
// that need a token.
func NewClient() *Client {
	return &Client{
		BaseURL:    ResolveAPIURL(),
		Token:      ResolveToken(),
		HTTPClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// RequireAuth returns an error suitable for the CLI when no token is set.
func (c *Client) RequireAuth() error {
	if c.Token == "" {
		return &APIError{
			Status:   0,
			Message:  "not authenticated — run `containr auth login <token>` or set CONTAINR_TOKEN",
			ExitCode: ExitAuth,
		}
	}
	return nil
}

// Do performs an API request. body may be nil, a []byte, or any value that
// marshals to JSON. Returns the raw response body.
func (c *Client) Do(method, path string, body interface{}) ([]byte, error) {
	var reader io.Reader
	if body != nil {
		var data []byte
		switch v := body.(type) {
		case []byte:
			data = v
		default:
			var err error
			data, err = json.Marshal(body)
			if err != nil {
				return nil, fmt.Errorf("failed to encode request: %w", err)
			}
		}
		reader = bytes.NewReader(data)
	}

	url := c.BaseURL + path
	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		return nil, err
	}
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")

	hc := c.HTTPClient
	if hc == nil {
		hc = &http.Client{Timeout: 60 * time.Second}
	}
	resp, err := hc.Do(req)
	if err != nil {
		return nil, &APIError{
			Status:   0,
			Message:  fmt.Sprintf("cannot reach %s: %v", c.BaseURL, err),
			ExitCode: ExitUnavailable,
		}
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		msg := strings.TrimSpace(string(data))
		var envelope struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(data, &envelope) == nil && envelope.Error != "" {
			msg = envelope.Error
		}
		return nil, &APIError{
			Status:   resp.StatusCode,
			Message:  msg,
			ExitCode: exitCodeFor(resp.StatusCode),
		}
	}
	return data, nil
}

// DoJSON performs a request and unmarshals the response into out.
func (c *Client) DoJSON(method, path string, body interface{}, out interface{}) error {
	data, err := c.Do(method, path, body)
	if err != nil {
		return err
	}
	if out == nil || len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, out)
}
