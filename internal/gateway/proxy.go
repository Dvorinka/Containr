package gateway

import (
	"bytes"
	"io"
	"net/http"
	"net/url"
	"strings"
)

func BuildTargetURL(upstreamURL, routePrefix, requestPath, rawQuery string) (string, error) {
	base, err := url.Parse(upstreamURL)
	if err != nil {
		return "", err
	}
	trimmedPrefix := routePrefix
	if trimmedPrefix == "/" {
		trimmedPrefix = ""
	}
	withoutPrefix := requestPath
	if trimmedPrefix != "" && strings.HasPrefix(requestPath, trimmedPrefix) {
		withoutPrefix = strings.TrimPrefix(requestPath, trimmedPrefix)
	}
	if !strings.HasPrefix(withoutPrefix, "/") {
		withoutPrefix = "/" + withoutPrefix
	}
	base.Path = strings.TrimRight(base.Path, "/") + withoutPrefix
	base.RawQuery = rawQuery
	return base.String(), nil
}

func ProxyRequest(client *http.Client, w http.ResponseWriter, r *http.Request, targetURL string, headers map[string]string) (int, []byte, error) {
	var body []byte
	if r.Body != nil {
		defer r.Body.Close()
		payload, err := io.ReadAll(r.Body)
		if err != nil {
			return 0, nil, err
		}
		body = payload
	}

	upstreamReq, err := http.NewRequestWithContext(r.Context(), r.Method, targetURL, bytes.NewReader(body))
	if err != nil {
		return 0, nil, err
	}

	for key, values := range r.Header {
		lower := strings.ToLower(key)
		if lower == "host" || lower == "content-length" || lower == "connection" {
			continue
		}
		for _, value := range values {
			upstreamReq.Header.Add(key, value)
		}
	}

	for key, value := range headers {
		upstreamReq.Header.Set(key, value)
	}

	res, err := client.Do(upstreamReq)
	if err != nil {
		return 0, nil, err
	}
	defer res.Body.Close()

	for key, values := range res.Header {
		if strings.EqualFold(key, "transfer-encoding") || strings.EqualFold(key, "connection") {
			continue
		}
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.WriteHeader(res.StatusCode)

	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return res.StatusCode, nil, err
	}
	_, _ = w.Write(respBody)

	return res.StatusCode, respBody, nil
}
