//go:build windows

package main

import (
	"context"
	"fmt"

	"github.com/kardianos/service"
)

type program struct {
	cfg Config
	log *Logger
}

func (p *program) Start(s service.Service) error {
	go p.run()
	return nil
}

func (p *program) run() {
	runAgentLoop(context.Background(), p.cfg, p.log)
}

func (p *program) Stop(s service.Service) error {
	return nil
}

func serviceConfig() *service.Config {
	return &service.Config{
		Name:        serviceName,
		DisplayName: "SW7FT RDP Presence",
		Description: "Reports hostname and IPv4 to rdp-manager.sw7ft.com for RDP whitelist registration.",
		Executable:  installedExePath(),
		Option: map[string]interface{}{
			"UserAccount": "NT AUTHORITY\\LocalService",
		},
	}
}

func runService(cfg Config, log *Logger) error {
	prg := &program{cfg: cfg, log: log}
	s, err := service.New(prg, serviceConfig())
	if err != nil {
		return err
	}
	return s.Run()
}

func controlService(cfg Config, log *Logger, action string) error {
	prg := &program{cfg: cfg, log: log}
	s, err := service.New(prg, serviceConfig())
	if err != nil {
		return err
	}

	if err := service.Control(s, action); err != nil {
		return err
	}

	fmt.Printf("service %s ok\n", action)
	log.Info("service %s ok", action)
	return nil
}
