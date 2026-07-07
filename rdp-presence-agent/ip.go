package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

func localIPv4() (string, error) {
	conn, err := net.DialTimeout("udp4", "8.8.8.8:80", 3*time.Second)
	if err != nil {
		return "", err
	}
	defer conn.Close()

	addr, ok := conn.LocalAddr().(*net.UDPAddr)
	if !ok || addr.IP == nil {
		return "", fmt.Errorf("could not determine local IPv4 address")
	}
	ip := addr.IP.To4()
	if ip == nil {
		return "", fmt.Errorf("no IPv4 address on primary interface")
	}
	return ip.String(), nil
}

type myIPResponse struct {
	IPv4 string `json:"ipv4"`
}

func publicIPv4(client *http.Client, myIPURL string) (string, error) {
	if myIPURL == "" {
		return "", fmt.Errorf("my-ip URL not configured")
	}

	req, err := http.NewRequest(http.MethodGet, myIPURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "SW7FT-RdpPresenceAgent/1.0")

	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(io.LimitReader(res.Body, 4096))
	if err != nil {
		return "", err
	}
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("my-ip HTTP %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}

	var parsed myIPResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", err
	}
	parsed.IPv4 = strings.TrimSpace(parsed.IPv4)
	if parsed.IPv4 == "" || net.ParseIP(parsed.IPv4) == nil {
		return "", fmt.Errorf("invalid my-ip response")
	}
	return parsed.IPv4, nil
}

func resolveReportIPv4(client *http.Client, myIPURL string) (reportIP, localIP string, err error) {
	localIP, err = localIPv4()
	if err != nil {
		localIP = ""
	}

	reportIP, pubErr := publicIPv4(client, myIPURL)
	if pubErr == nil {
		return reportIP, localIP, nil
	}

	if localIP != "" {
		return localIP, localIP, nil
	}
	return "", "", fmt.Errorf("public IP: %v; local IP: unavailable", pubErr)
}
