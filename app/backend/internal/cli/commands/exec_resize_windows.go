//go:build windows

package commands

// watchResize is a no-op on Windows — console resize events don't map to a
// signal. The initial size is still sent, and Windows Terminal resize is rare
// enough to accept stale dimensions for now.
func watchResize(send func()) func() { return func() {} }
