package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"runtime"
)

const serviceName = "RdpPresenceAgent"

var version = "1.0.0"

func main() {
	if len(os.Args) > 1 {
		cfg := loadConfig()
		log, err := newLogger(programDataDir())
		if err != nil {
			fmt.Fprintf(os.Stderr, "logger: %v\n", err)
			os.Exit(1)
		}
		if handled, err := handleSetupCommand(os.Args[1], cfg, log, version); handled {
			if err != nil {
				fmt.Fprintf(os.Stderr, "error: %v\n", err)
				os.Exit(1)
			}
			return
		}
	}

	console := flag.Bool("console", false, "Run in foreground (debug)")
	showVersion := flag.Bool("version", false, "Print version")
	flag.Parse()

	if *showVersion {
		fmt.Println(version)
		return
	}

	cfg := loadConfig()
	log, err := newLogger(programDataDir())
	if err != nil {
		fmt.Fprintf(os.Stderr, "logger: %v\n", err)
		os.Exit(1)
	}

	if *console || os.Getenv("RDP_PRESENCE_CONSOLE") == "1" {
		log.Info("starting in console mode")
		runAgentLoop(context.Background(), cfg, log)
		return
	}

	if runtime.GOOS == "windows" && !isInstalledLocation() {
		fmt.Println("SW7FT RDP Presence Agent — first-time setup")
		fmt.Println("Requesting administrator permission to install...")
		if err := elevateAndInstall(); err != nil {
			fmt.Fprintf(os.Stderr, "Install failed: %v\n", err)
			fmt.Fprintf(os.Stderr, "Run as Administrator: %s -install\n", os.Args[0])
			os.Exit(1)
		}
		return
	}

	if err := runService(cfg, log); err != nil {
		log.Error("service: %v", err)
		fmt.Fprintf(os.Stderr, "service: %v\n", err)
		os.Exit(1)
	}
}
