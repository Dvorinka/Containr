package logger

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLogger(t *testing.T) {
	var buf bytes.Buffer
	logger := New(DebugLevel, &buf)

	logger.Info("test message")

	var entry Entry
	err := json.Unmarshal(buf.Bytes(), &entry)
	assert.NoError(t, err)
	assert.Equal(t, "INFO", entry.Level)
	assert.Equal(t, "test message", entry.Message)
	assert.NotEmpty(t, entry.Timestamp)
}

func TestLoggerWithFields(t *testing.T) {
	var buf bytes.Buffer
	logger := New(InfoLevel, &buf)

	logger.WithFields(map[string]interface{}{
		"user_id": "123",
		"action":  "create",
	}).Info("user action")

	var entry Entry
	err := json.Unmarshal(buf.Bytes(), &entry)
	assert.NoError(t, err)
	assert.Equal(t, "123", entry.Fields["user_id"])
	assert.Equal(t, "create", entry.Fields["action"])
}

func TestLoggerWithError(t *testing.T) {
	var buf bytes.Buffer
	logger := New(InfoLevel, &buf)

	testErr := errors.New("test error")
	logger.WithError(testErr).Error("operation failed")

	var entry Entry
	err := json.Unmarshal(buf.Bytes(), &entry)
	assert.NoError(t, err)
	assert.Equal(t, "ERROR", entry.Level)
	assert.Equal(t, "test error", entry.Fields["error"])
}

func TestLoggerWithContext(t *testing.T) {
	var buf bytes.Buffer
	logger := New(InfoLevel, &buf)

	ctx := context.WithValue(context.Background(), "request_id", "req-123")
	ctx = context.WithValue(ctx, "user_id", "user-456")

	logger.WithContext(ctx).Info("request processed")

	var entry Entry
	err := json.Unmarshal(buf.Bytes(), &entry)
	assert.NoError(t, err)
	assert.Equal(t, "req-123", entry.Fields["request_id"])
	assert.Equal(t, "user-456", entry.Fields["user_id"])
}

func TestLogLevels(t *testing.T) {
	tests := []struct {
		name       string
		logLevel   Level
		logFunc    func(*Logger)
		shouldLog  bool
	}{
		{
			name:     "debug logs at debug level",
			logLevel: DebugLevel,
			logFunc:  func(l *Logger) { l.Debug("test") },
			shouldLog: true,
		},
		{
			name:     "debug doesn't log at info level",
			logLevel: InfoLevel,
			logFunc:  func(l *Logger) { l.Debug("test") },
			shouldLog: false,
		},
		{
			name:     "error logs at info level",
			logLevel: InfoLevel,
			logFunc:  func(l *Logger) { l.Error("test") },
			shouldLog: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			logger := New(tt.logLevel, &buf)
			tt.logFunc(logger)

			if tt.shouldLog {
				assert.NotEmpty(t, buf.String())
			} else {
				assert.Empty(t, buf.String())
			}
		})
	}
}
