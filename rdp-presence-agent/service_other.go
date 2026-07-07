//go:build !windows

package main

import "fmt"

func runService(cfg Config, log *Logger) error {
	log.Info("non-Windows build — use -console mode")
	return fmt.Errorf("Windows service mode requires GOOS=windows; run with -console for testing")
}
