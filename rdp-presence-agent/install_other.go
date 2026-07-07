//go:build !windows

package main

import "fmt"

func isInstalledLocation() bool { return false }

func handleSetupCommand(cmd string, cfg Config, log *Logger, version string) (handled bool, err error) {
	return false, nil
}

func elevateAndInstall() error {
	return fmt.Errorf("Windows installer requires GOOS=windows")
}
