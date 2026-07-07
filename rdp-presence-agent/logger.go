package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const maxLogBytes = 1024 * 1024

type Logger struct {
	mu   sync.Mutex
	path string
}

func newLogger(dir string) (*Logger, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Logger{path: filepath.Join(dir, "agent.log")}, nil
}

func (l *Logger) Info(format string, args ...any) {
	l.write("INFO", format, args...)
}

func (l *Logger) Error(format string, args ...any) {
	l.write("ERROR", format, args...)
}

func (l *Logger) write(level, format string, args ...any) {
	if l == nil {
		return
	}
	line := fmt.Sprintf("%s [%s] %s\n", time.Now().UTC().Format(time.RFC3339), level, fmt.Sprintf(format, args...))

	l.mu.Lock()
	defer l.mu.Unlock()

	if info, err := os.Stat(l.path); err == nil && info.Size() > maxLogBytes {
		backup := l.path + ".1"
		_ = os.Remove(backup)
		_ = os.Rename(l.path, backup)
	}

	f, err := os.OpenFile(l.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	_, _ = f.WriteString(line)
	_ = f.Close()
}
