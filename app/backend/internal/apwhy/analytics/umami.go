package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

type Client struct {
	BaseURL   string
	APIKey    string
	WebsiteID string
	HTTP      *http.Client
}

func NewClient(baseURL, apiKey, websiteID string) *Client {
	return &Client{
		BaseURL:   baseURL,
		APIKey:    apiKey,
		WebsiteID: websiteID,
		HTTP: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *Client) Enabled() bool {
	return c.BaseURL != "" && c.APIKey != "" && c.WebsiteID != ""
}

func (c *Client) FetchTraffic(ctx context.Context, from, to time.Time) (map[string]any, error) {
	if !c.Enabled() {
		return map[string]any{
			"enabled": false,
		}, nil
	}

	u, err := url.Parse(fmt.Sprintf("%s/api/websites/%s/stats", c.BaseURL, c.WebsiteID))
	if err != nil {
		return nil, err
	}

	query := u.Query()
	query.Set("startAt", fmt.Sprintf("%d", from.UnixMilli()))
	query.Set("endAt", fmt.Sprintf("%d", to.UnixMilli()))
	u.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Accept", "application/json")

	res, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("umami returned %d", res.StatusCode)
	}

	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return nil, err
	}
	payload["enabled"] = true
	return payload, nil
}
