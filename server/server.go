package server

import (
	"log"
	"net/http"
	"path/filepath"

	"github.com/Omieron/esp32-simulator/simulator"
	"github.com/gorilla/websocket"
)

// Server is the main HTTP / WebSocket server for the ESP32 simulator.
type Server struct {
	gpio     *simulator.GPIOState
	upgrader websocket.Upgrader
}

// NewServer creates a Server bound to the given GPIOState.
func NewServer(gpio *simulator.GPIOState) *Server {
	return &Server{
		gpio: gpio,
		upgrader: websocket.Upgrader{
			// Allow all origins during development.
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

// RegisterRoutes wires up all HTTP routes on the provided mux.
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/", s.HandleIndex)
	mux.HandleFunc("/ws", s.HandleWS)
}

// HandleIndex serves the frontend index.html page.
func (s *Server) HandleIndex(w http.ResponseWriter, r *http.Request) {
	// Only serve index.html for the root path; return 404 for unknown routes.
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	indexPath := filepath.Join("frontend", "index.html")
	http.ServeFile(w, r, indexPath)
}

// HandleWS upgrades the connection to WebSocket and echoes messages (placeholder).
func (s *Server) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	log.Println("websocket client connected")

	for {
		msgType, msg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("websocket read error: %v", err)
			break
		}
		log.Printf("websocket received: %s", string(msg))

		// Echo the message back (placeholder behaviour).
		if err := conn.WriteMessage(msgType, msg); err != nil {
			log.Printf("websocket write error: %v", err)
			break
		}
	}
}
