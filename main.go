package main

import (
	"log"
	"net/http"

	"github.com/Omieron/esp32-simulator/server"
)

func main() {
	// Create and configure the HTTP / WebSocket server.
	srv := server.NewServer(nil)
	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	addr := ":8080"
	log.Printf("ESP32-S3 Simulator starting on http://localhost%s", addr)

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
