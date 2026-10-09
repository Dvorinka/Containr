//go:build !windows

package commands

import (
	"os"
	"os/signal"
	"syscall"
)

// watchResize forwards SIGWINCH events to send. Returns a stop func.
func watchResize(send func()) func() {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGWINCH)
	done := make(chan struct{})
	go func() {
		for {
			select {
			case <-sigCh:
				send()
			case <-done:
				return
			}
		}
	}()
	return func() {
		signal.Stop(sigCh)
		close(done)
	}
}
