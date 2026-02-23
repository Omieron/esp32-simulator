import { useState, useRef, useCallback, useEffect } from 'react'
import { LEFT_PINS, RIGHT_PINS } from './pinDefinitions'
import type { PinState, PinDefinition } from './pinDefinitions'

// ===== Props Interface =====

export interface BoardProps {
    /** Current state of all GPIO pins (keyed by gpio number) */
    pinStates: Map<number, PinState>
    /** Called when a user clicks on a GPIO pin */
    onPinClick?: (gpio: number) => void
    /** Currently selected pin (for highlighting) */
    selectedPin?: number | null
}

// ===== Board Layout Constants =====
const BOARD_WIDTH = 440
const BOARD_HEIGHT = 560
const PIN_RADIUS = 7
const PIN_SPACING = 22
const PIN_START_Y = 80
const LEFT_PIN_X = 68
const RIGHT_PIN_X = BOARD_WIDTH - 68
const LABEL_OFFSET = 16
const PCB_LEFT = 90
const PCB_WIDTH = BOARD_WIDTH - 180

// ===== Helper: get pin color based on type and state =====
function getPinColor(pin: PinDefinition, pinStates: Map<number, PinState>, selectedPin?: number | null): string {
    if (pin.isPower) {
        if (pin.label === 'GND') return '#555'
        if (pin.label.includes('3V3')) return '#e94560'
        if (pin.label.includes('5V')) return '#f5a623'
        return '#888'
    }

    const state = pinStates.get(pin.gpio)
    if (selectedPin === pin.gpio) return '#3b82f6'
    if (state?.state === 'HIGH') return '#4ecca3'
    if (state?.mode === 'OUTPUT') return '#c084fc'
    return '#a0a0b0'
}

// ===== Single Pin Component =====
interface PinCircleProps {
    pin: PinDefinition
    x: number
    y: number
    side: 'left' | 'right'
    pinStates: Map<number, PinState>
    selectedPin?: number | null
    onPinClick?: (gpio: number) => void
    hoveredPin: number | null
    onHover: (gpio: number | null) => void
}

function PinCircle({ pin, x, y, side, pinStates, selectedPin, onPinClick, hoveredPin, onHover }: PinCircleProps) {
    const color = getPinColor(pin, pinStates, selectedPin)
    const isHovered = hoveredPin === pin.gpio
    const isInteractive = !pin.isPower

    // Label position — outside the board
    const labelX = side === 'left' ? x - LABEL_OFFSET : x + LABEL_OFFSET
    const textAnchor = side === 'left' ? 'end' : 'start'

    return (
        <g
            style={{ cursor: isInteractive ? 'pointer' : 'default' }}
            onClick={() => isInteractive && onPinClick?.(pin.gpio)}
            onMouseEnter={() => onHover(pin.gpio)}
            onMouseLeave={() => onHover(null)}
        >
            {/* Pin circle */}
            <circle
                cx={x}
                cy={y}
                r={isHovered && isInteractive ? PIN_RADIUS + 2 : PIN_RADIUS}
                fill={color}
                stroke={isHovered && isInteractive ? '#fff' : 'none'}
                strokeWidth={isHovered ? 2 : 0}
                style={{
                    transition: 'all 0.15s ease',
                    filter: isHovered && isInteractive ? `drop-shadow(0 0 6px ${color})` : 'none',
                }}
            />

            {/* Pin label on the outside */}
            <text
                x={labelX}
                y={y + 1}
                textAnchor={textAnchor}
                dominantBaseline="middle"
                fontSize={9}
                fontFamily="'JetBrains Mono', monospace"
                fill={isHovered ? '#fff' : '#888'}
                style={{ transition: 'fill 0.15s ease', userSelect: 'none' }}
            >
                {pin.label}
            </text>

            {/* Tooltip on hover — shows pin details */}
            {isHovered && isInteractive && (
                <g>
                    <rect
                        x={side === 'left' ? x + 14 : x - 110}
                        y={y - 14}
                        width={96}
                        height={28}
                        rx={6}
                        fill="#16213e"
                        stroke="#0f3460"
                        strokeWidth={1}
                    />
                    <text
                        x={side === 'left' ? x + 62 : x - 62}
                        y={y + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={10}
                        fontFamily="'Inter', sans-serif"
                        fill="#e0e0e0"
                    >
                        {`GPIO${pin.gpio} · ${pinStates.get(pin.gpio)?.mode ?? 'INPUT'}`}
                    </text>
                </g>
            )}
        </g>
    )
}

// ===== Main Board Component =====

// Default viewBox values
const DEFAULT_VB = { x: 0, y: 0, w: BOARD_WIDTH, h: BOARD_HEIGHT }
const MIN_ZOOM = 0.3
const MAX_ZOOM = 3

/**
 * Board renders an SVG representation of the ESP32-S3 DevKit-C board.
 * Supports pan (drag) and zoom (scroll wheel).
 */
export default function Board({ pinStates, onPinClick, selectedPin }: BoardProps) {
    const [hoveredPin, setHoveredPin] = useState<number | null>(null)

    // Pan & zoom state
    const [viewBox, setViewBox] = useState(DEFAULT_VB)
    const isPanning = useRef(false)
    const panStart = useRef({ x: 0, y: 0 })
    const svgRef = useRef<SVGSVGElement>(null)

    // Calculate current zoom level for display
    const zoomPercent = Math.round((1 / (viewBox.w / BOARD_WIDTH)) * 100)

    // Handle scroll wheel for zoom (centered on mouse position)
    const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
        e.preventDefault()
        const svg = svgRef.current
        if (!svg) return

        const rect = svg.getBoundingClientRect()
        // Mouse position relative to SVG element (0..1)
        const mx = (e.clientX - rect.left) / rect.width
        const my = (e.clientY - rect.top) / rect.height

        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9

        setViewBox((vb) => {
            const newW = vb.w * zoomFactor
            const newH = vb.h * zoomFactor
            const newZoom = BOARD_WIDTH / newW

            // Clamp zoom level
            if (newZoom < MIN_ZOOM || newZoom > MAX_ZOOM) return vb

            // Adjust origin so zoom is centered on mouse
            const newX = vb.x + (vb.w - newW) * mx
            const newY = vb.y + (vb.h - newH) * my

            return { x: newX, y: newY, w: newW, h: newH }
        })
    }, [viewBox.w])

    // Pan: mouse down
    const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        // Allow pan with left mouse button
        if (e.button !== 0) return
        isPanning.current = true
        panStart.current = { x: e.clientX, y: e.clientY }
        e.currentTarget.style.cursor = 'grabbing'
    }, [])

    // Pan: mouse move
    const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!isPanning.current || !svgRef.current) return

        const rect = svgRef.current.getBoundingClientRect()
        // Convert pixel delta to SVG coordinate delta
        const dx = (e.clientX - panStart.current.x) * (viewBox.w / rect.width)
        const dy = (e.clientY - panStart.current.y) * (viewBox.h / rect.height)

        setViewBox((vb) => ({
            ...vb,
            x: vb.x - dx,
            y: vb.y - dy,
        }))

        panStart.current = { x: e.clientX, y: e.clientY }
    }, [viewBox.w, viewBox.h])

    // Pan: mouse up
    const handleMouseUp = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        isPanning.current = false
        e.currentTarget.style.cursor = 'grab'
    }, [])

    // Reset view to default
    const handleReset = useCallback(() => {
        setViewBox(DEFAULT_VB)
    }, [])

    // Prevent default wheel behavior on the container to avoid page scroll
    useEffect(() => {
        const container = svgRef.current?.parentElement
        if (!container) return
        const prevent = (e: WheelEvent) => e.preventDefault()
        container.addEventListener('wheel', prevent, { passive: false })
        return () => container.removeEventListener('wheel', prevent)
    }, [])

    return (
        <div className="board-container">
            {/* Zoom controls overlay */}
            <div className="board-controls">
                <button className="board-controls__btn" onClick={() => setViewBox(vb => {
                    const f = 0.85
                    const newW = vb.w * f
                    const newH = vb.h * f
                    const newZoom = BOARD_WIDTH / newW
                    if (newZoom > MAX_ZOOM) return vb
                    return { x: vb.x + (vb.w - newW) / 2, y: vb.y + (vb.h - newH) / 2, w: newW, h: newH }
                })} title="Zoom in">+</button>
                <span className="board-controls__zoom">{zoomPercent}%</span>
                <button className="board-controls__btn" onClick={() => setViewBox(vb => {
                    const f = 1.15
                    const newW = vb.w * f
                    const newH = vb.h * f
                    const newZoom = BOARD_WIDTH / newW
                    if (newZoom < MIN_ZOOM) return vb
                    return { x: vb.x + (vb.w - newW) / 2, y: vb.y + (vb.h - newH) / 2, w: newW, h: newH }
                })} title="Zoom out">−</button>
                <button className="board-controls__btn" onClick={handleReset} title="Reset view">⟲</button>
            </div>

            <svg
                ref={svgRef}
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                className="board-svg"
                xmlns="http://www.w3.org/2000/svg"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: 'grab' }}
            >
                {/* Board PCB body */}
                <rect
                    x={PCB_LEFT}
                    y={12}
                    width={PCB_WIDTH}
                    height={BOARD_HEIGHT - 24}
                    rx={12}
                    fill="#1a3a2a"
                    stroke="#2d5a3d"
                    strokeWidth={2}
                />

                {/* PCB inner area with copper traces feel */}
                <rect
                    x={PCB_LEFT + 7}
                    y={20}
                    width={PCB_WIDTH - 14}
                    height={BOARD_HEIGHT - 40}
                    rx={8}
                    fill="#0d2818"
                    opacity={0.6}
                />

                {/* USB-C connector at the top */}
                <rect x={BOARD_WIDTH / 2 - 30} y={6} width={60} height={18} rx={4} fill="#888" stroke="#aaa" strokeWidth={1} />
                <rect x={BOARD_WIDTH / 2 - 20} y={10} width={40} height={10} rx={2} fill="#555" />
                <text x={BOARD_WIDTH / 2} y={17} textAnchor="middle" fontSize={6} fill="#ccc" fontFamily="'Inter', sans-serif">USB-C</text>

                {/* ESP32-S3 Chip in the center */}
                <rect x={BOARD_WIDTH / 2 - 60} y={200} width={120} height={120} rx={4} fill="#222" stroke="#444" strokeWidth={1.5} />
                <rect x={BOARD_WIDTH / 2 - 52} y={208} width={104} height={104} rx={2} fill="#1a1a1a" />

                {/* Chip label */}
                <text x={BOARD_WIDTH / 2} y={252} textAnchor="middle" fontSize={11} fontWeight="bold" fontFamily="'Inter', sans-serif" fill="#4ecca3">
                    ESP32-S3
                </text>
                <text x={BOARD_WIDTH / 2} y={268} textAnchor="middle" fontSize={8} fontFamily="'Inter', sans-serif" fill="#666">
                    WROOM-1
                </text>

                {/* Antenna at the top of the chip area */}
                <rect x={BOARD_WIDTH / 2 - 35} y={40} width={70} height={50} rx={3} fill="none" stroke="#4ecca355" strokeWidth={1} strokeDasharray="3 2" />
                <text x={BOARD_WIDTH / 2} y={70} textAnchor="middle" fontSize={7} fontFamily="'Inter', sans-serif" fill="#4ecca355">
                    ANTENNA
                </text>

                {/* Boot & Reset buttons */}
                <rect x={PCB_LEFT + 20} y={370} width={24} height={14} rx={3} fill="#333" stroke="#555" strokeWidth={1} />
                <text x={PCB_LEFT + 32} y={395} textAnchor="middle" fontSize={6} fill="#888" fontFamily="'Inter', sans-serif">BOOT</text>

                <rect x={BOARD_WIDTH - PCB_LEFT - 44} y={370} width={24} height={14} rx={3} fill="#333" stroke="#555" strokeWidth={1} />
                <text x={BOARD_WIDTH - PCB_LEFT - 32} y={395} textAnchor="middle" fontSize={6} fill="#888" fontFamily="'Inter', sans-serif">RST</text>

                {/* Built-in RGB LED indicator */}
                <circle cx={BOARD_WIDTH - PCB_LEFT - 30} cy={440} r={5} fill={pinStates.get(48)?.state === 'HIGH' ? '#4ecca3' : '#222'} stroke="#4ecca3" strokeWidth={1}>
                    {pinStates.get(48)?.state === 'HIGH' && (
                        <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />
                    )}
                </circle>
                <text x={BOARD_WIDTH - PCB_LEFT - 30} y={455} textAnchor="middle" fontSize={6} fill="#666" fontFamily="'Inter', sans-serif">LED</text>

                {/* Power LED */}
                <circle cx={PCB_LEFT + 30} cy={440} r={4} fill="#e9456066" stroke="#e94560" strokeWidth={1} />
                <text x={PCB_LEFT + 30} y={455} textAnchor="middle" fontSize={6} fill="#666" fontFamily="'Inter', sans-serif">PWR</text>

                {/* Left side pins */}
                {LEFT_PINS.map((pin, i) => (
                    <PinCircle
                        key={`left-${i}`}
                        pin={pin}
                        x={LEFT_PIN_X}
                        y={PIN_START_Y + i * PIN_SPACING}
                        side="left"
                        pinStates={pinStates}
                        selectedPin={selectedPin}
                        onPinClick={onPinClick}
                        hoveredPin={hoveredPin}
                        onHover={setHoveredPin}
                    />
                ))}

                {/* Right side pins */}
                {RIGHT_PINS.map((pin, i) => (
                    <PinCircle
                        key={`right-${i}`}
                        pin={pin}
                        x={RIGHT_PIN_X}
                        y={PIN_START_Y + i * PIN_SPACING}
                        side="right"
                        pinStates={pinStates}
                        selectedPin={selectedPin}
                        onPinClick={onPinClick}
                        hoveredPin={hoveredPin}
                        onHover={setHoveredPin}
                    />
                ))}

                {/* Board model label at the bottom */}
                <text x={BOARD_WIDTH / 2} y={BOARD_HEIGHT - 18} textAnchor="middle" fontSize={8} fontFamily="'Inter', sans-serif" fill="#4ecca355">
                    ESP32-S3-DevKitC-1
                </text>
            </svg>
        </div>
    )
}
