import { useState, useCallback, useRef } from 'react'
import { createRuntime } from '../simulator/runtime'
import { transpile } from '../simulator/transpiler'
import type { PinState } from '../components/pinDefinitions'

// ===== Hook Return Type =====

const MAX_SERIAL_LINES = 500

export interface UseSimulationReturn {
  /** Pin states during JS simulation (used when isSimRunning) */
  simPinStates: Map<number, PinState>
  /** Serial output from Serial.println during JS simulation */
  simSerialOutput: string[]
  /** Whether JS simulation is currently running */
  isSimRunning: boolean
  /** Last transpile or runtime error */
  lastError: string | null
  /** OLED display pixel buffer (128×64, each byte 0 or 1) */
  displayBuffer: Uint8Array | null
  /** Active buzzer tone (pin + frequency), null when silent */
  activeTone: { pin: number; frequency: number } | null
  /** Start simulation with Arduino code (transpiled to JS) */
  startSimulation: (code: string) => void
  /** Stop the running simulation */
  stopSimulation: () => void
  /** Update pin state from outside (e.g. button press). For Task 3+ integration. */
  setPinState: (pin: number, state: 'HIGH' | 'LOW') => void
  /** Clear serial output */
  clearSimSerial: () => void
}

// ===== Initial Pin State =====

function createInitialPinStates(): Map<number, PinState> {
  const map = new Map<number, PinState>()
  for (let i = 0; i < 49; i++) {
    map.set(i, { number: i, mode: 'INPUT', state: 'LOW' })
  }
  return map
}

// ===== Hook Implementation =====

export default function useSimulation(): UseSimulationReturn {
  const [simPinStates, setSimPinStates] = useState<Map<number, PinState>>(
    createInitialPinStates
  )
  const [simSerialOutput, setSimSerialOutput] = useState<string[]>([])
  const [isSimRunning, setIsSimRunning] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [displayBuffer, setDisplayBuffer] = useState<Uint8Array | null>(null)
  const [activeTone, setActiveTone] = useState<{ pin: number; frequency: number } | null>(null)
  const runningRef = useRef(false)
  const runtimeRef = useRef<ReturnType<typeof createRuntime> | null>(null)

  const startSimulation = useCallback((code: string) => {
    // Stop any previous run
    runningRef.current = false

    const result = transpile(code)
    if (!result.success) {
      setLastError(result.error ?? 'Transpile failed')
      return
    }

    setLastError(null)

    const runtime = createRuntime({
      onPinChange: (pin, state, mode) => {
        setSimPinStates((prev) => {
          const next = new Map(prev)
          next.set(pin, { number: pin, mode, state })
          return next
        })
      },
      onSerial: (data: string) => {
        setSimSerialOutput((prev) => {
          const lines = [...prev, data]
          return lines.length > MAX_SERIAL_LINES
            ? lines.slice(lines.length - MAX_SERIAL_LINES)
            : lines
        })
      },
      onDisplayUpdate: (buffer: Uint8Array) => {
        setDisplayBuffer(buffer)
      },
      onToneChange: (pin: number, frequency: number | null) => {
        setActiveTone(frequency !== null ? { pin, frequency } : null)
      },
    })

    runtimeRef.current = runtime

    // Initialize pin states from runtime snapshot
    const snapshot = runtime.getPinSnapshot()
    setSimPinStates((prev) => {
      const next = new Map(prev)
      for (const p of snapshot) {
        next.set(p.number, { number: p.number, mode: p.mode, state: p.state })
      }
      return next
    })

    setSimSerialOutput([])
    setIsSimRunning(true)
    runningRef.current = true

    const runTranspiled = async () => {
      try {
        const factory = eval(result.jsCode!)
        const { setup, loop } = factory(runtime)
        await setup()
        while (runningRef.current) {
          await loop()
        }
      } catch (err) {
        setLastError(err instanceof Error ? err.message : String(err))
      } finally {
        runtimeRef.current = null
        setIsSimRunning(false)
        setSimPinStates(createInitialPinStates())
      }
    }
    runTranspiled()
  }, [])

  const stopSimulation = useCallback(() => {
    runningRef.current = false
    runtimeRef.current = null
    setIsSimRunning(false)
    setSimPinStates(createInitialPinStates())
    setDisplayBuffer(null)
    setActiveTone(null)
    setLastError(null)
  }, [])

  const setPinState = useCallback((pin: number, state: 'HIGH' | 'LOW') => {
    const runtime = runtimeRef.current
    if (runtime) {
      runtime.setPinState(pin, state)
    }
  }, [])

  const clearSimSerial = useCallback(() => {
    setSimSerialOutput([])
  }, [])

  return {
    simPinStates,
    simSerialOutput,
    isSimRunning,
    lastError,
    displayBuffer,
    activeTone,
    startSimulation,
    stopSimulation,
    setPinState,
    clearSimSerial,
  }
}
