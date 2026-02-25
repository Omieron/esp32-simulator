/**
 * ESP32-S3 Simulator — Arduino API Runtime (JS)
 * Mimics Arduino API in TypeScript for browser-based simulation.
 */

import { OLEDDisplay, SSD1306_SWITCHCAPVCC, OLED_WHITE, OLED_BLACK } from './oled'

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
  analogValue: number
  pwmValue: number
}

export interface RuntimeCallbacks {
  onPinChange?: (pin: number, state: PinState, mode: PinMode, pwmValue?: number) => void
  onSerial?: (data: string) => void
  onDisplayUpdate?: (buffer: Uint8Array) => void
  /** Fired when tone() or noTone() is called. frequency=null means stopped. */
  onToneChange?: (pin: number, frequency: number | null) => void
}

export interface ArduinoRuntime {
  pinMode: (pin: number, mode: number) => void
  digitalWrite: (pin: number, value: number) => void
  digitalRead: (pin: number) => number
  analogRead: (pin: number) => number
  analogWrite: (pin: number, value: number) => void
  delay: (ms: number) => Promise<void>
  tone: (pin: number, frequency: number, duration?: number) => void
  noTone: (pin: number) => void
  Serial: { begin: (baud: number) => void; println: (msg: string | number) => void }
  Wire: { begin: () => void }
  display: OLEDDisplay
  HIGH: number
  LOW: number
  INPUT: number
  OUTPUT: number
  INPUT_PULLUP: number
  SSD1306_SWITCHCAPVCC: number
  WHITE: number
  BLACK: number
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
  /** Update analog value from outside (e.g. potentiometer slider). */
  setPinAnalog: (pin: number, value: number) => void
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
  const { onPinChange, onSerial, onDisplayUpdate, onToneChange } = callbacks

  // Internal pin state storage
  const pins: PinData[] = Array.from({ length: TOTAL_PINS }, () => ({
    mode: 'INPUT' as PinMode,
    state: 'LOW' as PinState,
    analogValue: 0,
    pwmValue: 0,
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
    pins[idx].pwmValue = pins[idx].state === 'HIGH' ? 255 : 0
    onPinChange?.(pin, pins[idx].state, pins[idx].mode, pins[idx].pwmValue)
  }

  const digitalRead = (pin: number): number => {
    validatePin(pin)
    const idx = pin - MIN_PIN
    return pins[idx].state === 'HIGH' ? HIGH : LOW
  }

  const analogRead = (pin: number): number => {
    validatePin(pin)
    const idx = pin - MIN_PIN
    return pins[idx].analogValue
  }

  const analogWrite = (pin: number, value: number): void => {
    validatePin(pin)
    const clamped = Math.max(0, Math.min(255, Math.round(value)))
    const idx = pin - MIN_PIN
    pins[idx].pwmValue = clamped
    pins[idx].state = clamped > 0 ? 'HIGH' : 'LOW'
    onPinChange?.(pin, pins[idx].state, pins[idx].mode, clamped)
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
    begin: (_baud: number): void => {},
    println: (msg: string | number): void => {
      onSerial?.(String(msg))
    },
  }

  // Active tone timers (for duration-based auto-stop)
  const toneTimers = new Map<number, ReturnType<typeof setTimeout>>()

  const tone = (pin: number, frequency: number, duration?: number): void => {
    validatePin(pin)
    const idx = pin - MIN_PIN
    pins[idx].mode = 'OUTPUT'
    pins[idx].state = 'HIGH'
    onPinChange?.(pin, 'HIGH', 'OUTPUT')
    onToneChange?.(pin, frequency)

    // Clear any existing auto-stop timer for this pin
    const existing = toneTimers.get(pin)
    if (existing) clearTimeout(existing)

    // If duration is specified, auto-stop after that many milliseconds
    if (duration && duration > 0) {
      toneTimers.set(pin, setTimeout(() => {
        noTone(pin)
        toneTimers.delete(pin)
      }, duration))
    }
  }

  const noTone = (pin: number): void => {
    validatePin(pin)
    const idx = pin - MIN_PIN
    pins[idx].state = 'LOW'
    onPinChange?.(pin, 'LOW', pins[idx].mode)
    onToneChange?.(pin, null)

    const existing = toneTimers.get(pin)
    if (existing) {
      clearTimeout(existing)
      toneTimers.delete(pin)
    }
  }

  const Wire = {
    begin: (): void => {},
  }

  const display = new OLEDDisplay({ onDisplayUpdate })

  // Host API: for external updates (e.g. button press) and UI sync
  const setPinState = (pin: number, state: PinState): void => {
    validatePin(pin)
    const idx = pin - MIN_PIN
    pins[idx].state = state
    onPinChange?.(pin, pins[idx].state, pins[idx].mode)
  }

  const setPinAnalog = (pin: number, value: number): void => {
    validatePin(pin)
    const idx = pin - MIN_PIN
    pins[idx].analogValue = Math.max(0, Math.min(4095, Math.round(value)))
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
    analogRead,
    analogWrite,
    tone,
    noTone,
    delay,
    Serial,
    Wire,
    display,
    HIGH,
    LOW,
    INPUT,
    OUTPUT,
    INPUT_PULLUP,
    SSD1306_SWITCHCAPVCC,
    WHITE: OLED_WHITE,
    BLACK: OLED_BLACK,
    setPinState,
    setPinAnalog,
    getPinSnapshot,
  }
}
