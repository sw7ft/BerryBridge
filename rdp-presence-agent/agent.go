package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

type PresencePayload struct {
	Hostname  string `json:"hostname"`
	IPv4      string `json:"ipv4"`
	LocalIPv4 string `json:"local_ipv4,omitempty"`
	Timestamp string `json:"timestamp"`
}

type agentState struct {
	lastHost string
	lastIPv4 string
}

func newHTTPClient() *http.Client {
	return &http.Client{Timeout: 20 * time.Second}
}

func postPresence(client *http.Client, cfg Config, payload PresencePayload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, cfg.PresenceURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "SW7FT-RdpPresenceAgent/1.0")

	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("presence HTTP %d: %s", res.StatusCode, string(respBody))
	}
	return nil
}

func buildPayload(client *http.Client, cfg Config) (PresencePayload, error) {
	hostname, err := os.Hostname()
	if err != nil {
		return PresencePayload{}, err
	}

	reportIP, localIP, err := resolveReportIPv4(client, cfg.MyIPURL)
	if err != nil {
		return PresencePayload{}, err
	}

	payload := PresencePayload{
		Hostname:  hostname,
		IPv4:      reportIP,
		LocalIPv4: localIP,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	if payload.LocalIPv4 == payload.IPv4 {
		payload.LocalIPv4 = ""
	}
	return payload, nil
}

func runAgentLoop(ctx context.Context, cfg Config, log *Logger) {
	client := newHTTPClient()
	state := agentState{}
	backoff := 30 * time.Second
	const maxBackoff = 15 * time.Minute

	for {
		payload, buildErr := buildPayload(client, cfg)
		if buildErr != nil {
			log.Error("build payload: %v", buildErr)
		} else {
			changed := payload.Hostname != state.lastHost || payload.IPv4 != state.lastIPv4
			if changed || state.lastHost == "" {
				if err := postPresence(client, cfg, payload); err != nil {
					log.Error("post presence: %v", err)
					select {
					case <-ctx.Done():
						return
					case <-time.After(backoff):
					}
					if backoff < maxBackoff {
						backoff *= 2
						if backoff > maxBackoff {
							backoff = maxBackoff
						}
					}
					continue
				}
				state.lastHost = payload.Hostname
				state.lastIPv4 = payload.IPv4
				backoff = 30 * time.Second
				log.Info("reported hostname=%s ipv4=%s local_ipv4=%s", payload.Hostname, payload.IPv4, payload.LocalIPv4)
			}
		}

		wait := cfg.heartbeatInterval()
		select {
		case <-ctx.Done():
			return
		case <-time.After(wait):
		}
	}
}
