package main

import (
	"fmt"
	"log"
	"net/http"

	"apwhy/internal/api"
	"apwhy/internal/config"
	"apwhy/internal/storage"
)

func main() {
	cfg := config.Load()

	store, err := storage.Open(cfg)
	if err != nil {
		log.Fatalf("failed to initialize storage: %v", err)
	}
	defer store.Close()

	server := api.NewServer(store, cfg)

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("APwhy server listening on http://localhost%s", addr)
	if err := http.ListenAndServe(addr, server.Handler()); err != nil {
		log.Fatalf("server exited: %v", err)
	}
}
