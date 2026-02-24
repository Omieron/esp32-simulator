import { useState, useEffect, useRef, useCallback } from 'react'
import type { PinState } from '../components/pinDefinitions'

// ===== WebSocket Message Protocol =====

/** Messages FROM client TO server */
export type ClientMessage =
    | { type: 'upload_code'; code: string }
    | { type: 'stop' }
    | { type: 'set_pin'; pin: number; state: 'HIGH' | 'LOW' }
    | { type: 'button_press'; pin: number; pressed: boolean }

/** Messages FROM server TO client */
export type ServerMessage =
    | { type: 'pin_update'; pins: { number: number; mode: 'INPUT' | 'OUTPUT'; state: 'HIGH' | 'LOW' }[] }
    | { type: 'serial_output'; data: string }
    | { type: 'compile_error'; error: string }
    | { type: 'compile_success'; binPath?: string }
    | { type: 'status'; running: boolean; message: string }

// ===== Connection Status =====

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

// ===== Hook Return Type =====

export interface UseWebSocketReturn {
    /** Current connection status */
    status: ConnectionStatus
    /** All pin states received from backend */
    pinStates: Map<number, PinState>
    /** Serial monitor output lines */
    serialOutput: string[]
    /** Whether code is currently running */
    isRunning: boolean
    /** Last compile/status error message */
    lastError: string | null
    /** Upload Arduino code and start execution */
    uploadCode: (code: string) => void
    /** Stop the running sketch */
    stopExecution: () => void
    /** Set a pin state (e.g. from physical button component) */
    setPin: (pin: number, state: 'HIGH' | 'LOW') => void
    /** Simulate button press/release on a pin */
    buttonPress: (pin: number, pressed: boolean) => void
    /** Clear serial output */
    clearSerial: () => void
}

// ===== Configuration =====

const WS_URL = `ws://${window.location.hostname}:8080/ws`
const RECONNECT_DELAY = 2000
const MAX_SERIAL_LINES = 500

// ===== Hook Implementation =====

export default function useWebSocket(): UseWebSocketReturn {
    const [status, setStatus] = useState<ConnectionStatus>('disconnected')
    const [pinStates, setPinStates] = useState<Map<number, PinState>>(() => {
        const map = new Map<number, PinState>()
        for (let i = 0; i < 49; i++) {
            map.set(i, { number: i, mode: 'INPUT', state: 'LOW' })
        }
        return map
    })
    const [serialOutput, setSerialOutput] = useState<string[]>([])
    const [isRunning, setIsRunning] = useState(false)
    const [lastError, setLastError] = useState<string | null>(null)

    const wsRef = useRef<WebSocket | null>(null)
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const mountedRef = useRef(true)

    // ===== Send helper =====
    const send = useCallback((msg: ClientMessage) => {
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg))
        }
    }, [])

    // ===== Handle incoming messages =====
    const handleMessage = useCallback((event: MessageEvent) => {
        try {
            const msg: ServerMessage = JSON.parse(event.data)

            switch (msg.type) {
                case 'pin_update':
                    setPinStates(prev => {
                        const next = new Map(prev)
                        for (const pin of msg.pins) {
                            next.set(pin.number, {
                                number: pin.number,
                                mode: pin.mode,
                                state: pin.state,
                            })
                        }
                        return next
                    })
                    break

                case 'serial_output':
                    setSerialOutput(prev => {
                        const lines = [...prev, msg.data]
                        // Cap at MAX_SERIAL_LINES
                        return lines.length > MAX_SERIAL_LINES
                            ? lines.slice(lines.length - MAX_SERIAL_LINES)
                            : lines
                    })
                    break

                case 'compile_error':
                    setLastError(msg.error)
                    setIsRunning(false)
                    break

                case 'compile_success':
                    setLastError(null)
                    // binPath available for future flash/simulation use
                    break

                case 'status':
                    setIsRunning(msg.running)
                    if (msg.message) {
                        setLastError(msg.running ? null : msg.message)
                    }
                    break
            }
        } catch (err) {
            console.error('[WS] Failed to parse message:', err)
        }
    }, [])

    // ===== Connect / Reconnect =====
    const connect = useCallback(() => {
        // Clean up existing connection
        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }

        if (!mountedRef.current) return

        setStatus('connecting')

        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        ws.onopen = () => {
            if (!mountedRef.current) return
            setStatus('connected')
            setLastError(null)
            console.log('[WS] Connected to', WS_URL)
        }

        ws.onmessage = handleMessage

        ws.onerror = () => {
            if (!mountedRef.current) return
            setStatus('error')
        }

        ws.onclose = () => {
            if (!mountedRef.current) return
            setStatus('disconnected')
            wsRef.current = null

            // Auto-reconnect
            reconnectTimer.current = setTimeout(() => {
                if (mountedRef.current) {
                    connect()
                }
            }, RECONNECT_DELAY)
        }
    }, [handleMessage])

    // ===== Lifecycle =====
    useEffect(() => {
        mountedRef.current = true
        connect()

        return () => {
            mountedRef.current = false
            if (reconnectTimer.current) {
                clearTimeout(reconnectTimer.current)
            }
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
        }
    }, [connect])

    // ===== Public API =====
    const uploadCode = useCallback((code: string) => {
        setLastError(null)
        setSerialOutput([])
        send({ type: 'upload_code', code })
    }, [send])

    const stopExecution = useCallback(() => {
        send({ type: 'stop' })
    }, [send])

    const setPin = useCallback((pin: number, state: 'HIGH' | 'LOW') => {
        send({ type: 'set_pin', pin, state })
    }, [send])

    const buttonPress = useCallback((pin: number, pressed: boolean) => {
        send({ type: 'button_press', pin, pressed })
    }, [send])

    const clearSerial = useCallback(() => {
        setSerialOutput([])
    }, [])

    return {
        status,
        pinStates,
        serialOutput,
        isRunning,
        lastError,
        uploadCode,
        stopExecution,
        setPin,
        buttonPress,
        clearSerial,
    }
}
