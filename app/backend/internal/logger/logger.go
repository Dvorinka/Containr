package logger

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"runtime"
	"time"
)

// Level represents log severity
type Level int

const (
	DebugLevel Level = iota
	InfoLevel
	WarnLevel
	ErrorLevel
	FatalLevel
)

func (l Level) String() string {
	switch l {
	case DebugLevel:
		return "DEBUG"
	case InfoLevel:
		return "INFO"
	case WarnLevel:
		return "WARN"
	case ErrorLevel:
		return "ERROR"
	case FatalLevel:
		return "FATAL"
	default:
		return "UNKNOWN"
	}
}

// Logger provides structured logging
type Logger struct {
	level  Level
	output io.Writer
	fields map[string]interface{}
}

// Entry represents a log entry
type Entry struct {
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
	Caller    string                 `json:"caller,omitempty"`
	Error     string                 `json:"error,omitempty"`
}

var defaultLogger *Logger

func init() {
	defaultLogger = New(InfoLevel, os.Stdout)
}

// New creates a new logger
func New(level Level, output io.Writer) *Logger {
	return &Logger{
		level:  level,
		output: output,
		fields: make(map[string]interface{}),
	}
}

// WithField adds a field to the logger
func (l *Logger) WithField(key string, value interface{}) *Logger {
	newLogger := &Logger{
		level:  l.level,
		output: l.output,
		fields: make(map[string]interface{}),
	}
	for k, v := range l.fields {
		newLogger.fields[k] = v
	}
	newLogger.fields[key] = value
	return newLogger
}

// WithFields adds multiple fields to the logger
func (l *Logger) WithFields(fields map[string]interface{}) *Logger {
	newLogger := &Logger{
		level:  l.level,
		output: l.output,
		fields: make(map[string]interface{}),
	}
	for k, v := range l.fields {
		newLogger.fields[k] = v
	}
	for k, v := range fields {
		newLogger.fields[k] = v
	}
	return newLogger
}

// WithError adds an error to the logger
func (l *Logger) WithError(err error) *Logger {
	if err == nil {
		return l
	}
	return l.WithField("error", err.Error())
}

// WithContext extracts fields from context
func (l *Logger) WithContext(ctx context.Context) *Logger {
	newLogger := l
	if requestID := ctx.Value("request_id"); requestID != nil {
		newLogger = newLogger.WithField("request_id", requestID)
	}
	if userID := ctx.Value("user_id"); userID != nil {
		newLogger = newLogger.WithField("user_id", userID)
	}
	return newLogger
}

func (l *Logger) log(level Level, message string, err error) {
	if level < l.level {
		return
	}

	entry := Entry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Level:     level.String(),
		Message:   message,
		Fields:    l.fields,
	}

	if err != nil {
		entry.Error = err.Error()
	}

	// Add caller information for errors and above
	if level >= ErrorLevel {
		_, file, line, ok := runtime.Caller(2)
		if ok {
			entry.Caller = fmt.Sprintf("%s:%d", file, line)
		}
	}

	data, _ := json.Marshal(entry)
	fmt.Fprintln(l.output, string(data))

	if level == FatalLevel {
		os.Exit(1)
	}
}

// Debug logs a debug message
func (l *Logger) Debug(message string) {
	l.log(DebugLevel, message, nil)
}

// Debugf logs a formatted debug message
func (l *Logger) Debugf(format string, args ...interface{}) {
	l.log(DebugLevel, fmt.Sprintf(format, args...), nil)
}

// Info logs an info message
func (l *Logger) Info(message string) {
	l.log(InfoLevel, message, nil)
}

// Infof logs a formatted info message
func (l *Logger) Infof(format string, args ...interface{}) {
	l.log(InfoLevel, fmt.Sprintf(format, args...), nil)
}

// Warn logs a warning message
func (l *Logger) Warn(message string) {
	l.log(WarnLevel, message, nil)
}

// Warnf logs a formatted warning message
func (l *Logger) Warnf(format string, args ...interface{}) {
	l.log(WarnLevel, fmt.Sprintf(format, args...), nil)
}

// Error logs an error message
func (l *Logger) Error(message string) {
	l.log(ErrorLevel, message, nil)
}

// Errorf logs a formatted error message
func (l *Logger) Errorf(format string, args ...interface{}) {
	l.log(ErrorLevel, fmt.Sprintf(format, args...), nil)
}

// ErrorWithErr logs an error with error object
func (l *Logger) ErrorWithErr(message string, err error) {
	l.log(ErrorLevel, message, err)
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(message string) {
	l.log(FatalLevel, message, nil)
}

// Fatalf logs a formatted fatal message and exits
func (l *Logger) Fatalf(format string, args ...interface{}) {
	l.log(FatalLevel, fmt.Sprintf(format, args...), nil)
}

// Package-level functions using default logger
func Debug(message string) {
	defaultLogger.Debug(message)
}

func Debugf(format string, args ...interface{}) {
	defaultLogger.Debugf(format, args...)
}

func Info(message string) {
	defaultLogger.Info(message)
}

func Infof(format string, args ...interface{}) {
	defaultLogger.Infof(format, args...)
}

func Warn(message string) {
	defaultLogger.Warn(message)
}

func Warnf(format string, args ...interface{}) {
	defaultLogger.Warnf(format, args...)
}

func Error(message string) {
	defaultLogger.Error(message)
}

func Errorf(format string, args ...interface{}) {
	defaultLogger.Errorf(format, args...)
}

func ErrorWithErr(message string, err error) {
	defaultLogger.ErrorWithErr(message, err)
}

func Fatal(message string) {
	defaultLogger.Fatal(message)
}

func Fatalf(format string, args ...interface{}) {
	defaultLogger.Fatalf(format, args...)
}

func WithField(key string, value interface{}) *Logger {
	return defaultLogger.WithField(key, value)
}

func WithFields(fields map[string]interface{}) *Logger {
	return defaultLogger.WithFields(fields)
}

func WithError(err error) *Logger {
	return defaultLogger.WithError(err)
}

func WithContext(ctx context.Context) *Logger {
	return defaultLogger.WithContext(ctx)
}

// SetLevel sets the default logger level
func SetLevel(level Level) {
	defaultLogger.level = level
}

// SetOutput sets the default logger output
func SetOutput(output io.Writer) {
	defaultLogger.output = output
}
