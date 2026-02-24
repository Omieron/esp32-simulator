import { useState, useCallback, useRef } from 'react'
import { createRuntime } from '../simulator/runtime'
import type { PinState } from '../components/pinDefinitions'

// ===== Hook Return Type =====

export interface UseSimulationReturn {
  /** Pin states during JS simulation (used when isSimRunning) */
  simPinStates: Map<number, PinState>
  /** Whether JS simulation is currently running */
  isSimRunning: boolean
  /** Start a test simulation (blinks GPIO 2). Will be replaced by transpiled code in Task 6. */
  startSimulation: () => void
  /** Stop the running simulation */
  stopSimulation: () => void
  /** Update pin state from outside (e.g. button press). For Task 3+ integration. */
  setPinState: (pin: number, state: 'HIGH' | 'LOW') => void
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
  const [isSimRunning, setIsSimRunning] = useState(false)
  const runningRef = useRef(false)
  const runtimeRef = useRef<ReturnType<typeof createRuntime> | null>(null)

  const startSimulation = useCallback(() => {
    // Stop any previous run
    runningRef.current = false

    const runtime = createRuntime({
      onPinChange: (pin, state, mode) => {
        setSimPinStates((prev) => {
          const next = new Map(prev)
          next.set(pin, { number: pin, mode, state })
          return next
        })
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

    setIsSimRunning(true)
    runningRef.current = true

    // Test: blink GPIO 2 using async delay (same pattern as transpiled setup/loop)
    const runBlink = async () => {
      runtime.pinMode(2, runtime.OUTPUT)
      let high = true
      while (runningRef.current) {
        runtime.digitalWrite(2, high ? runtime.HIGH : runtime.LOW)
        high = !high
        await runtime.delay(1000)
      }
    }
    runBlink()
  }, [])

  const stopSimulation = useCallback(() => {
    runningRef.current = false
    runtimeRef.current = null
    setIsSimRunning(false)
    setSimPinStates(createInitialPinStates())
  }, [])

  const setPinState = useCallback((pin: number, state: 'HIGH' | 'LOW') => {
    const runtime = runtimeRef.current
    if (runtime) {
      runtime.setPinState(pin, state)
    }
  }, [])

  return {
    simPinStates,
    isSimRunning,
    startSimulation,
    stopSimulation,
    setPinState,
  }
}
