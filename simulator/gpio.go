package simulator

import (
	"fmt"
	"sync"
)

// PinMode represents the direction of a GPIO pin.
type PinMode int

const (
	INPUT  PinMode = iota // Pin is configured as input
	OUTPUT                // Pin is configured as output
)

// PinState represents the logical level of a GPIO pin.
type PinState int

const (
	LOW  PinState = iota // Logic low (0V)
	HIGH                 // Logic high (3.3V)
)

// TotalPins is the number of GPIO pins on the ESP32-S3.
const TotalPins = 40

// Pin represents a single GPIO pin with its current configuration.
type Pin struct {
	Number int      `json:"number"`
	Mode   PinMode  `json:"mode"`
	State  PinState `json:"state"`
}

// GPIOState holds the state of all GPIO pins on the board.
type GPIOState struct {
	mu   sync.RWMutex
	Pins [TotalPins]Pin `json:"pins"`
}

// NewGPIOState creates a new GPIOState with all pins initialised to INPUT / LOW.
func NewGPIOState() *GPIOState {
	g := &GPIOState{}
	for i := 0; i < TotalPins; i++ {
		g.Pins[i] = Pin{
			Number: i,
			Mode:   INPUT,
			State:  LOW,
		}
	}
	return g
}

// validatePin checks whether the pin number is within range.
func validatePin(pin int) error {
	if pin < 0 || pin >= TotalPins {
		return fmt.Errorf("invalid pin number %d: must be 0-%d", pin, TotalPins-1)
	}
	return nil
}

// SetPinMode configures the given pin as INPUT or OUTPUT.
func (g *GPIOState) SetPinMode(pin int, mode PinMode) error {
	if err := validatePin(pin); err != nil {
		return err
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	g.Pins[pin].Mode = mode
	return nil
}

// WritePin sets the logical level of the given pin.
func (g *GPIOState) WritePin(pin int, state PinState) error {
	if err := validatePin(pin); err != nil {
		return err
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	g.Pins[pin].State = state
	return nil
}

// ReadPin returns the current state of the given pin.
func (g *GPIOState) ReadPin(pin int) (PinState, error) {
	if err := validatePin(pin); err != nil {
		return LOW, err
	}
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.Pins[pin].State, nil
}
