package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

const (
	DefaultPresenceURL = "https://rdp-manager.sw7ft.com/api/presence"
	DefaultMyIPURL     = "https://rdp-manager.sw7ft.com/api/my-ip"
	DefaultHeartbeat   = 5 * time.Minute
	programDataSubdir  = "SW7FT" + string(os.PathSeparator) + "RdpPresence"
)

type Config struct {
	PresenceURL      string `json:"presence_url"`
	MyIPURL          string `json:"my_ip_url"`
	HeartbeatSeconds int    `json:"heartbeat_seconds"`
}

func defaultConfig() Config {
	return Config{
		PresenceURL:      DefaultPresenceURL,
		MyIPURL:          DefaultMyIPURL,
		HeartbeatSeconds: int(DefaultHeartbeat.Seconds()),
	}
}

func (c Config) heartbeatInterval() time.Duration {
	if c.HeartbeatSeconds <= 0 {
		return DefaultHeartbeat
	}
	return time.Duration(c.HeartbeatSeconds) * time.Second
}

func programDataDir() string {
	base := os.Getenv("PROGRAMDATA")
	if base == "" {
		base = filepath.Join(os.Getenv("SystemDrive")+string(os.PathSeparator), "ProgramData")
	}
	if base == "" || base == string(os.PathSeparator) {
		base = `C:\ProgramData`
	}
	return filepath.Join(base, "SW7FT", "RdpPresence")
}

func loadConfig() Config {
	cfg := defaultConfig()
	path := filepath.Join(programDataDir(), "config.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return cfg
	}
	_ = json.Unmarshal(data, &cfg)
	if cfg.PresenceURL == "" {
		cfg.PresenceURL = DefaultPresenceURL
	}
	if cfg.MyIPURL == "" {
		cfg.MyIPURL = DefaultMyIPURL
	}
	if cfg.HeartbeatSeconds <= 0 {
		cfg.HeartbeatSeconds = int(DefaultHeartbeat.Seconds())
	}
	return cfg
}
