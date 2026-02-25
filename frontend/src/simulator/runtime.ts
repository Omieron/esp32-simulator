/**
 * ESP32-S3 Simulator — Arduino API Runtime (JS)
 * Mimics Arduino API in TypeScript for browser-based simulation.
 */

// ===== Constants (Arduino equivalents) =====

export const HIGH = 1
export const LOW = 0
export const INPUT = 0
export const OUTPUT = 1
export const INPUT_PULLUP = 2

// ===== Types =====

export type PinState = 'HIGH' | 'LOW'
export type PinMode = 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP'

export interface PinData {
  mode: PinMode
  state: PinState
}

export interface RuntimeCallbacks {
  onPinChange?: (pin: number, state: PinState, mode: PinMode) => void
  onSerial?: (data: string) => void
}

export interface ArduinoRuntime {
  pinMode: (pin: number, mode: number) => void
  digitalWrite: (pin: number, value: number) => void
  digitalRead: (pin: number) => number
  analogWrite: (pin: number, value: number) => void
  delay: (ms: number) => Promise<void>
  Serial: { begin: (baud: number) => void; println: (msg: string | number) => void }
  HIGH: number
  LOW: number
  INPUT: number
  OUTPUT: number
  INPUT_PULLUP: number
}

/** Snapshot item for a single pin (used by getPinSnapshot). */
export interface PinSnapshotItem {
  number: number
  mode: PinMode
  state: PinState
}

/** Host API: methods for the simulator host (App), not for user code. */
export interface RuntimeHostAPI {
  /** Update pin state from outside (e.g. button press). Used in Task 3. */
  setPinState: (pin: number, state: PinState) => void
  /** Get full pin state for UI sync (startup or full refresh). */
  getPinSnapshot: () => PinSnapshotItem[]
}

export type SimulatorRuntime = ArduinoRuntime & RuntimeHostAPI

// ===== Configuration =====

const MIN_PIN = 0
const MAX_PIN = 48
const TOTAL_PINS = MAX_PIN - MIN_PIN + 1

// ===== Pin validation =====

function validatePin(pin: number): void {
  if (typeof pin !== 'number' || !Number.isInteger(pin) || Number.isNaN(pin)) {
    throw new Error(
      `Invalid pin number: ${pin}. Pin must be an integer. Please check your pin configuration.`
    )
  }
  if (pin < MIN_PIN || pin > MAX_PIN) {
    throw new Error(
      `Invalid pin number: ${pin}. Valid range is ${MIN_PIN}–${MAX_PIN}. Please check your pin configuration.`
    )
  }
}

// ===== Create runtime =====

/**
 * Creates an Arduino-compatible runtime with the given callbacks.
 * The returned object can be injected into transpiled user code.
 * Includes host API (setPinState, getPinSnapshot) for simulator integration.
 */
export function createRuntime(callbacks: RuntimeCallbacks = {}): SimulatorRuntime {
  const { onPinChange, onSerial } = callbacks

  // Internal pin state storage
  const pins: PinData[] = Array.from({ length: TOTAL_PINS }, () => ({
    mode: 'INPUT' as PinMode,
    state: 'LOW' as PinState,
  }))

  const toState = (value: number): PinState =>
    value === HIGH || value === 1 ? 'HIGH' : 'LOW'

  const toMode = (mode: number): PinMode => {
    if (mode === OUTPUT || mode === 1) return 'OUTPUT'
    if (mode === INPUT_PULLUP || mode === 2) return 'INPUT_PULLUP'
    return 'INPUT'
  }

  const pinMode = (pin: number, mode: number): void => {
    validatePin(pin)
    const idx = pin - MIN_PIN
    pins[idx].mode = toMode(mode)
    // INPUT_PULLUP enables internal pull-up resistor → pin reads HIGH by default
    if (pins[idx].mode === 'INPUT_PULLUP') {
      pins[idx].state = 'HIGH'
    }
    onPinChange?.(pin, pins[idx].state, pins[idx].mode)
  }

  const digitalWrite = (pin: number, value: number): void => {
    validatePin(pin)
    const idx = pin - MIN_PIN
    pins[idx].state = toState(value)
    onPinChange?.(pin, pins[idx].state, pins[idx].mode)
  }

  const digitalRead = (pin: number): number => {
    validatePin(pin)
    const idx = pin - MIN_PIN
    return pins[idx].state === 'HIGH' ? HIGH : LOW
  }

  const analogWrite = (pin: number, value: number): void => {
    validatePin(pin)
    // Simple simulation: value > 127 → HIGH, else LOW
    const state: PinState = value > 127 ? 'HIGH' : 'LOW'
    const idx = pin - MIN_PIN
    pins[idx].state = state
    onPinChange?.(pin, pins[idx].state, pins[idx].mode)
  }

  /**
   * Non-blocking delay. Returns a Promise that resolves after ms milliseconds.
   * Use with await: await delay(1000)
   * Transpiled setup/loop must be async to use await delay().
   */
  const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  const Serial = {
    begin: (_baud: number): void => {
      // No-op for simulation
    },
    println: (msg: string | number): void => {
      onSerial?.(String(msg))
    },
  }

  // Host API: for external updates (e.g. button press) and UI sync
  const setPinState = (pin: number, state: PinState): void => {
    validatePin(pin)
    const idx = pin - MIN_PIN
    pins[idx].state = state
    onPinChange?.(pin, pins[idx].state, pins[idx].mode)
  }

  const getPinSnapshot = (): PinSnapshotItem[] =>
    pins.map((p, i) => ({
      number: i + MIN_PIN,
      mode: p.mode,
      state: p.state,
    }))

  return {
    pinMode,
    digitalWrite,
    digitalRead,
    analogWrite,
    delay,
    Serial,
    HIGH,
    LOW,
    INPUT,
    OUTPUT,
    INPUT_PULLUP,
    setPinState,
    getPinSnapshot,
  }
}
