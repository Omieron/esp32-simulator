package server

import (
	"encoding/json"
	"log"
	"net/http"
	"path/filepath"

	"github.com/Omieron/esp32-simulator/simulator"
	"github.com/gorilla/websocket"
)

// ===== Message Types =====

// ClientMessage represents a message from the browser.
type ClientMessage struct {
	Type    string `json:"type"`
	Code    string `json:"code,omitempty"`
	Pin     int    `json:"pin,omitempty"`
	State   string `json:"state,omitempty"`
	Pressed bool   `json:"pressed,omitempty"`
}

// ServerMessage represents a message from the server.
type ServerMessage struct {
	Type    string    `json:"type"`
	Pins    []PinJSON `json:"pins,omitempty"`
	Data    string    `json:"data,omitempty"`
	Error   string    `json:"error,omitempty"`
	Running bool      `json:"running,omitempty"`
	Message string    `json:"message,omitempty"`
}

// PinJSON is one pin's state for the wire format.
type PinJSON struct {
	Number int    `json:"number"`
	Mode   string `json:"mode"`
	State  string `json:"state"`
}

// ===== Server =====

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
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	indexPath := filepath.Join("frontend", "index.html")
	http.ServeFile(w, r, indexPath)
}

// modeString converts PinMode to a string.
func modeString(m simulator.PinMode) string {
	if m == simulator.OUTPUT {
		return "OUTPUT"
	}
	return "INPUT"
}

// stateString converts PinState to a string.
func stateString(s simulator.PinState) string {
	if s == simulator.HIGH {
		return "HIGH"
	}
	return "LOW"
}

// buildPinSnapshot returns all pins as JSON-ready structs.
func (s *Server) buildPinSnapshot() []PinJSON {
	pins := make([]PinJSON, simulator.TotalPins)
	for i := 0; i < simulator.TotalPins; i++ {
		state, _ := s.gpio.ReadPin(i)
		pins[i] = PinJSON{
			Number: i,
			Mode:   modeString(s.gpio.Pins[i].Mode),
			State:  stateString(state),
		}
	}
	return pins
}

// sendJSON is a helper to write a JSON message to the WebSocket.
func sendJSON(conn *websocket.Conn, msg ServerMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return conn.WriteMessage(websocket.TextMessage, data)
}

// HandleWS upgrades the connection to WebSocket and processes JSON messages.
func (s *Server) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	log.Println("websocket client connected")

	// Send initial pin state snapshot
	if err := sendJSON(conn, ServerMessage{
		Type: "pin_update",
		Pins: s.buildPinSnapshot(),
	}); err != nil {
		log.Printf("failed to send initial state: %v", err)
		return
	}

	// Send connected status
	sendJSON(conn, ServerMessage{
		Type:    "status",
		Running: false,
		Message: "Ready",
	})

	// Read loop
	for {
		_, rawMsg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("websocket read error: %v", err)
			break
		}

		var msg ClientMessage
		if err := json.Unmarshal(rawMsg, &msg); err != nil {
			log.Printf("invalid message: %v", err)
			continue
		}

		log.Printf("received: %s", msg.Type)

		switch msg.Type {
		case "upload_code":
			log.Printf("code uploaded (%d bytes)", len(msg.Code))
			// TODO: compile & run the Arduino sketch
			sendJSON(conn, ServerMessage{
				Type:    "status",
				Running: true,
				Message: "Running sketch...",
			})
			// Placeholder: echo a serial message
			sendJSON(conn, ServerMessage{
				Type: "serial_output",
				Data: "ESP32-S3 Simulator Ready!",
			})

		case "stop":
			log.Println("stop requested")
			sendJSON(conn, ServerMessage{
				Type:    "status",
				Running: false,
				Message: "Stopped",
			})

		case "set_pin":
			state := simulator.LOW
			if msg.State == "HIGH" {
				state = simulator.HIGH
			}
			if err := s.gpio.WritePin(msg.Pin, state); err != nil {
				log.Printf("set_pin error: %v", err)
			} else {
				// Broadcast updated pin state
				pinState, _ := s.gpio.ReadPin(msg.Pin)
				sendJSON(conn, ServerMessage{
					Type: "pin_update",
					Pins: []PinJSON{{
						Number: msg.Pin,
						Mode:   modeString(s.gpio.Pins[msg.Pin].Mode),
						State:  stateString(pinState),
					}},
				})
			}

		case "button_press":
			state := simulator.LOW
			if msg.Pressed {
				state = simulator.HIGH
			}
			if err := s.gpio.WritePin(msg.Pin, state); err != nil {
				log.Printf("button_press error: %v", err)
			} else {
				pinState, _ := s.gpio.ReadPin(msg.Pin)
				sendJSON(conn, ServerMessage{
					Type: "pin_update",
					Pins: []PinJSON{{
						Number: msg.Pin,
						Mode:   modeString(s.gpio.Pins[msg.Pin].Mode),
						State:  stateString(pinState),
					}},
				})
			}

		default:
			log.Printf("unknown message type: %s", msg.Type)
		}
	}
}
