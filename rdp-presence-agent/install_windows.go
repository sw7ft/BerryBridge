//go:build windows

package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"golang.org/x/sys/windows/registry"
)

const (
	installDirName = `SW7FT\RdpPresence`
	exeFileName    = "rdp-presence-agent.exe"
	uninstallKey   = `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\SW7FTRdpPresence`
)

func installedExePath() string {
	programFiles := os.Getenv("ProgramFiles")
	if programFiles == "" {
		programFiles = `C:\Program Files`
	}
	return filepath.Join(programFiles, installDirName, exeFileName)
}

func isInstalledLocation() bool {
	self, err := os.Executable()
	if err != nil {
		return false
	}
	self, _ = filepath.Abs(self)
	target, _ := filepath.Abs(installedExePath())
	return strings.EqualFold(filepath.Clean(self), filepath.Clean(target))
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func grantLocalServiceWrite(dir string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	cmd := exec.Command("icacls.exe", dir, "/grant", "*S-1-5-19:(OI)(CI)M", "/T", "/C")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func registerUninstall(exePath, version string) error {
	k, _, err := registry.CreateKey(registry.LOCAL_MACHINE, uninstallKey, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()

	_ = k.SetStringValue("DisplayName", "SW7FT RDP Presence Agent")
	_ = k.SetStringValue("Publisher", "SW7FT")
	_ = k.SetStringValue("DisplayVersion", version)
	_ = k.SetStringValue("UninstallString", fmt.Sprintf(`"%s" -uninstall`, exePath))
	_ = k.SetStringValue("InstallLocation", filepath.Dir(exePath))
	_ = k.SetDWordValue("NoModify", 1)
	_ = k.SetDWordValue("NoRepair", 1)
	return nil
}

func unregisterUninstall() error {
	return registry.DeleteKey(registry.LOCAL_MACHINE, uninstallKey)
}

func runInstalled(exePath string, args ...string) error {
	cmd := exec.Command(exePath, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func selfInstall(cfg Config, log *Logger, version string) error {
	if isInstalledLocation() {
		return runServiceControl(cfg, log, "install", "start")
	}

	self, err := os.Executable()
	if err != nil {
		return err
	}
	self, err = filepath.Abs(self)
	if err != nil {
		return err
	}

	target := installedExePath()
	fmt.Printf("Installing to %s\n", target)

	if err := copyFile(self, target); err != nil {
		return fmt.Errorf("copy binary: %w", err)
	}

	if err := grantLocalServiceWrite(programDataDir()); err != nil {
		fmt.Printf("warning: could not set log folder permissions: %v\n", err)
	}

	if err := registerUninstall(target, version); err != nil {
		return fmt.Errorf("register uninstall: %w", err)
	}

	if err := runInstalled(target, "install"); err != nil {
		return fmt.Errorf("service install: %w", err)
	}
	if err := runInstalled(target, "start"); err != nil {
		return fmt.Errorf("service start: %w", err)
	}

	fmt.Println("Installation complete. The agent runs in the background at boot.")
	log.Info("installed to %s", target)
	return nil
}

func selfUninstall(cfg Config, log *Logger) error {
	target := installedExePath()

	if _, err := os.Stat(target); err == nil {
		_ = runInstalled(target, "stop")
		_ = runInstalled(target, "uninstall")
		_ = os.Remove(target)
	}

	_ = unregisterUninstall()
	fmt.Println("Uninstalled SW7FT RDP Presence Agent.")
	log.Info("uninstalled")
	return nil
}

func elevateAndInstall() error {
	self, err := os.Executable()
	if err != nil {
		return err
	}
	self, err = filepath.Abs(self)
	if err != nil {
		return err
	}

	ps := fmt.Sprintf(
		"Start-Process -FilePath %q -ArgumentList '-install' -Verb RunAs -Wait",
		self,
	)
	cmd := exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func runServiceControl(cfg Config, log *Logger, actions ...string) error {
	for _, action := range actions {
		if err := controlService(cfg, log, action); err != nil {
			return err
		}
	}
	return nil
}

func normalizeCmd(cmd string) string {
	cmd = strings.TrimSpace(cmd)
	cmd = strings.TrimPrefix(cmd, "/")
	cmd = strings.TrimPrefix(cmd, "-")
	return strings.ToLower(cmd)
}

func handleSetupCommand(cmd string, cfg Config, log *Logger, version string) (handled bool, err error) {
	switch normalizeCmd(cmd) {
	case "install", "setup":
		if !isInstalledLocation() {
			if err := selfInstall(cfg, log, version); err != nil {
				return true, err
			}
			return true, nil
		}
		return true, runServiceControl(cfg, log, "install", "start")
	case "uninstall", "remove":
		return true, selfUninstall(cfg, log)
	case "start", "stop", "restart":
		return true, controlService(cfg, log, normalizeCmd(cmd))
	default:
		return false, nil
	}
}
