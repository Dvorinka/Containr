package commands

import (
	"encoding/json"
	"fmt"
	"time"
)

// client returns an authenticated API client or an ExitAuth error.
func client() (*Client, error) {
	c := NewClient()
	if err := c.RequireAuth(); err != nil {
		return nil, err
	}
	return c, nil
}

// unwrapList accepts both top-level arrays and {"<key>": [...]} envelopes,
// which the Containr API uses inconsistently between endpoints.
func unwrapList(data []byte, keys ...string) ([]map[string]interface{}, error) {
	var arr []map[string]interface{}
	if err := json.Unmarshal(data, &arr); err == nil {
		return arr, nil
	}
	var obj map[string]json.RawMessage
	if err := json.Unmarshal(data, &obj); err != nil {
		return nil, fmt.Errorf("unexpected response shape: %w", err)
	}
	for _, k := range keys {
		if raw, ok := obj[k]; ok {
			if err := json.Unmarshal(raw, &arr); err != nil {
				return nil, fmt.Errorf("cannot decode %q: %w", k, err)
			}
			return arr, nil
		}
	}
	return []map[string]interface{}{}, nil
}

func unwrapObject(data []byte, keys ...string) (map[string]interface{}, error) {
	var obj map[string]interface{}
	if err := json.Unmarshal(data, &obj); err != nil {
		return nil, fmt.Errorf("unexpected response shape: %w", err)
	}
	for _, k := range keys {
		if inner, ok := obj[k].(map[string]interface{}); ok {
			return inner, nil
		}
	}
	return obj, nil
}

// str extracts a display string from a response map.
func str(m map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			switch t := v.(type) {
			case string:
				return t
			case float64:
				if t == float64(int64(t)) {
					return fmt.Sprintf("%d", int64(t))
				}
				return fmt.Sprintf("%v", t)
			case bool:
				return fmt.Sprintf("%t", t)
			}
		}
	}
	return "-"
}

func shortID(m map[string]interface{}) string {
	id := str(m, "id")
	if len(id) > 8 {
		return id[:8]
	}
	return id
}

func relTime(m map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		s, ok := m[k].(string)
		if !ok || s == "" {
			continue
		}
		t, err := time.Parse(time.RFC3339Nano, s)
		if err != nil {
			return s
		}
		d := time.Since(t)
		switch {
		case d < time.Minute:
			return "just now"
		case d < time.Hour:
			return fmt.Sprintf("%dm ago", int(d.Minutes()))
		case d < 24*time.Hour:
			return fmt.Sprintf("%dh ago", int(d.Hours()))
		default:
			return fmt.Sprintf("%dd ago", int(d.Hours()/24))
		}
	}
	return "-"
}

// printRows renders a table, or raw JSON for the full response in --json mode.
func printRows(raw []byte, headers []string, rows [][]string) {
	if JSONMode() {
		PrintRaw(raw)
		return
	}
	PrintTable(headers, rows)
}
