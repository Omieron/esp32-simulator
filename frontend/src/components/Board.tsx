import { useState, useRef, useCallback, useEffect } from 'react'
import { LEFT_PINS, RIGHT_PINS } from './pinDefinitions'
import type { PinState, PinDefinition } from './pinDefinitions'

// ===== Placed Component Types =====

export type ComponentType = 'led' | 'button'

export interface PlacedComponent {
    id: string
    type: ComponentType
    x: number
    y: number
    color: string
    label: string
    on: boolean  // LED: lit state, Button: pressed state
}

// ===== Props Interface =====

export interface BoardProps {
    pinStates: Map<number, PinState>
    onPinClick?: (gpio: number) => void
    selectedPin?: number | null
    /** Placed components on the board */
    placedComponents: PlacedComponent[]
    onComponentsChange: (components: PlacedComponent[]) => void
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

// ===== Pin Color Helper =====
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

// ===== PinCircle Sub-Component =====
interface PinCircleProps {
    pin: PinDefinition
    x: number; y: number; side: 'left' | 'right'
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
    const labelX = side === 'left' ? x - LABEL_OFFSET : x + LABEL_OFFSET
    const textAnchor = side === 'left' ? 'end' : 'start'

    return (
        <g
            style={{ cursor: isInteractive ? 'pointer' : 'default' }}
            onClick={(e) => { e.stopPropagation(); isInteractive && onPinClick?.(pin.gpio) }}
            onMouseEnter={() => onHover(pin.gpio)}
            onMouseLeave={() => onHover(null)}
        >
            <circle
                cx={x} cy={y}
                r={isHovered && isInteractive ? PIN_RADIUS + 2 : PIN_RADIUS}
                fill={color}
                stroke={isHovered && isInteractive ? '#fff' : 'none'}
                strokeWidth={isHovered ? 2 : 0}
                style={{ transition: 'all 0.15s ease', filter: isHovered && isInteractive ? `drop-shadow(0 0 6px ${color})` : 'none' }}
            />
            <text x={labelX} y={y + 1} textAnchor={textAnchor} dominantBaseline="middle"
                fontSize={9} fontFamily="'JetBrains Mono', monospace"
                fill={isHovered ? '#fff' : '#888'} style={{ transition: 'fill 0.15s ease', userSelect: 'none' }}>
                {pin.label}
            </text>
            {isHovered && isInteractive && (
                <g>
                    <rect x={side === 'left' ? x + 14 : x - 110} y={y - 14} width={96} height={28} rx={6}
                        fill="#16213e" stroke="#0f3460" strokeWidth={1} />
                    <text x={side === 'left' ? x + 62 : x - 62} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                        fontSize={10} fontFamily="'Inter', sans-serif" fill="#e0e0e0">
                        {`GPIO${pin.gpio} · ${pinStates.get(pin.gpio)?.mode ?? 'INPUT'}`}
                    </text>
                </g>
            )}
        </g>
    )
}

// ===== Placed LED SVG Element =====
interface PlacedLEDProps {
    comp: PlacedComponent
    onDragStart: (id: string, e: React.MouseEvent) => void
    onSelect: (id: string) => void
    isDragging: boolean
    isSelected: boolean
}

function PlacedLED({ comp, onDragStart, onSelect, isDragging, isSelected }: PlacedLEDProps) {
    const r = 20
    return (
        <g
            transform={`translate(${comp.x}, ${comp.y})`}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={(e) => { e.stopPropagation(); onSelect(comp.id); onDragStart(comp.id, e) }}
        >
            {/* Selection ring */}
            {isSelected && (
                <circle cx={0} cy={0} r={r + 8} fill="none" stroke="#3b82f6" strokeWidth={2}
                    strokeDasharray="5 3" opacity={0.8}>
                    <animate attributeName="stroke-dashoffset" values="0;16" dur="1s" repeatCount="indefinite" />
                </circle>
            )}

            {/* Glow when ON (only when wired — future) */}
            {comp.on && (
                <circle cx={0} cy={0} r={r + 12} fill={comp.color} opacity={0.25}
                    style={{ filter: 'blur(6px)' }}>
                    <animate attributeName="opacity" values="0.25;0.1;0.25" dur="2s" repeatCount="indefinite" />
                </circle>
            )}

            {/* LED base (dark ring) */}
            <circle cx={0} cy={0} r={r + 3} fill="#1a1a2e" stroke="#444" strokeWidth={2} />

            {/* LED dome */}
            <circle cx={0} cy={0} r={r} fill={comp.on ? comp.color : '#333'}
                stroke={comp.on ? comp.color : '#555'} strokeWidth={1.5}
                opacity={comp.on ? 0.9 : 0.25} />

            {/* Tinted dome hint (show what color when off) */}
            {!comp.on && (
                <circle cx={0} cy={0} r={r} fill={comp.color} opacity={0.08} />
            )}

            {/* Highlight reflection */}
            <ellipse cx={-4} cy={-5} rx={6} ry={4} fill="white" opacity={0.25} />

            {/* Metal legs */}
            <rect x={-6} y={r + 3} width={3} height={12} fill="#999" rx={1} />
            <rect x={3} y={r + 3} width={3} height={16} fill="#999" rx={1} />


        </g>
    )
}

// ===== Placed Button SVG Element =====
interface PlacedButtonProps {
    comp: PlacedComponent
    onDragStart: (id: string, e: React.MouseEvent) => void
    onSelect: (id: string) => void
    onPress: (id: string, pressed: boolean) => void
    isDragging: boolean
    isSelected: boolean
}

function PlacedButton({ comp, onDragStart, onSelect, onPress, isDragging, isSelected }: PlacedButtonProps) {
    const w = 52
    const h = 40
    const capColor = comp.color

    return (
        <g
            transform={`translate(${comp.x}, ${comp.y})`}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={(e) => { e.stopPropagation(); onSelect(comp.id); onDragStart(comp.id, e) }}
        >
            {/* Selection ring */}
            {isSelected && (
                <rect x={-w / 2 - 6} y={-h / 2 - 6} width={w + 12} height={h + 12} rx={6}
                    fill="none" stroke="#3b82f6" strokeWidth={2}
                    strokeDasharray="5 3" opacity={0.8}>
                    <animate attributeName="stroke-dashoffset" values="0;16" dur="1s" repeatCount="indefinite" />
                </rect>
            )}

            {/* Button housing (black body) */}
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4}
                fill="#1a1a1a" stroke="#444" strokeWidth={2} />

            {/* Inner cavity */}
            <rect x={-w / 2 + 5} y={-h / 2 + 5} width={w - 10} height={h - 10} rx={3}
                fill="#111" />

            {/* Button cap (plunger) */}
            <rect
                x={-w / 2 + 8} y={comp.on ? -h / 2 + 10 : -h / 2 + 7}
                width={w - 16} height={h - 16} rx={3}
                fill={capColor}
                stroke={comp.on ? '#fff3' : '#0003'}
                strokeWidth={1.5}
                opacity={comp.on ? 1 : 0.85}
            />
            {/* Cap highlight */}
            {!comp.on && (
                <rect x={-w / 2 + 11} y={-h / 2 + 9} width={w - 22} height={4} rx={2}
                    fill="white" opacity={0.2} />
            )}

            {/* 4 metal pins */}
            <rect x={-w / 2 - 5} y={-7} width={6} height={4} fill="#999" rx={1} />
            <rect x={-w / 2 - 5} y={4} width={6} height={4} fill="#999" rx={1} />
            <rect x={w / 2 - 1} y={-7} width={6} height={4} fill="#999" rx={1} />
            <rect x={w / 2 - 1} y={4} width={6} height={4} fill="#999" rx={1} />



            {/* Press area — mousedown/up for tactile press feel */}
            <rect x={-w / 2 + 5} y={-h / 2 + 5} width={w - 10} height={h - 10} fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => { e.stopPropagation(); onPress(comp.id, true) }}
                onMouseUp={() => onPress(comp.id, false)}
                onMouseLeave={() => { if (comp.on) onPress(comp.id, false) }}
            />
        </g>
    )
}

// ===== Component Palette Items (grouped by category) =====
interface PaletteCategory {
    title: string
    items: { type: ComponentType; label: string; icon: string; defaultColor: string }[]
}

const PALETTE_CATEGORIES: PaletteCategory[] = [
    {
        title: '💡 LEDs',
        items: [
            { type: 'led', label: 'Red LED', icon: '🔴', defaultColor: '#ff3333' },
            { type: 'led', label: 'Green LED', icon: '🟢', defaultColor: '#33ff33' },
            { type: 'led', label: 'Blue LED', icon: '🔵', defaultColor: '#3388ff' },
            { type: 'led', label: 'Yellow LED', icon: '🟡', defaultColor: '#ffdd33' },
            { type: 'led', label: 'White LED', icon: '⚪', defaultColor: '#ffffff' },
        ],
    },
    {
        title: '🔘 Buttons',
        items: [
            { type: 'button', label: 'Push Button', icon: '⬛', defaultColor: '#555' },
            { type: 'button', label: 'Red Button', icon: '🟥', defaultColor: '#cc3333' },
            { type: 'button', label: 'Blue Button', icon: '🟦', defaultColor: '#3366cc' },
        ],
    },
]

// ===== Main Board Component =====

const DEFAULT_VB = { x: 0, y: 0, w: BOARD_WIDTH, h: BOARD_HEIGHT }
const MIN_ZOOM = 0.3
const MAX_ZOOM = 3

let componentIdCounter = 0
function nextId() { return `comp-${++componentIdCounter}` }

export default function Board({ pinStates, onPinClick, selectedPin, placedComponents, onComponentsChange }: BoardProps) {
    const [hoveredPin, setHoveredPin] = useState<number | null>(null)

    // Pan & zoom
    const [viewBox, setViewBox] = useState(DEFAULT_VB)
    const isPanning = useRef(false)
    const panStart = useRef({ x: 0, y: 0 })
    const svgRef = useRef<SVGSVGElement>(null)
    const zoomPercent = Math.round((1 / (viewBox.w / BOARD_WIDTH)) * 100)

    // Board position (draggable like components)
    const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 })

    // Palette & placement mode
    const [showPalette, setShowPalette] = useState(false)
    const [placementMode, setPlacementMode] = useState<{ type: ComponentType; color: string; label: string } | null>(null)
    const [deleteMode, setDeleteMode] = useState(false)

    // Dragging & selecting — '__board__' is the special ID for the board itself
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null)
    const dragOffset = useRef({ x: 0, y: 0 })

    // Convert screen coords to SVG coords
    const screenToSVG = useCallback((clientX: number, clientY: number) => {
        const svg = svgRef.current
        if (!svg) return { x: 0, y: 0 }
        const rect = svg.getBoundingClientRect()
        const x = viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.w
        const y = viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.h
        return { x, y }
    }, [viewBox])

    // ===== Zoom =====
    const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
        e.preventDefault()
        const svg = svgRef.current
        if (!svg) return
        const rect = svg.getBoundingClientRect()
        const mx = (e.clientX - rect.left) / rect.width
        const my = (e.clientY - rect.top) / rect.height
        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9
        setViewBox((vb) => {
            const newW = vb.w * zoomFactor
            const newH = vb.h * zoomFactor
            const newZoom = BOARD_WIDTH / newW
            if (newZoom < MIN_ZOOM || newZoom > MAX_ZOOM) return vb
            return { x: vb.x + (vb.w - newW) * mx, y: vb.y + (vb.h - newH) * my, w: newW, h: newH }
        })
    }, [])

    // ===== Pan =====
    const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (e.button !== 0 || placementMode || draggingId) return
        isPanning.current = true
        panStart.current = { x: e.clientX, y: e.clientY }
        e.currentTarget.style.cursor = 'grabbing'
    }, [placementMode, draggingId])

    const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        // Handle dragging (board or component)
        if (draggingId) {
            const pos = screenToSVG(e.clientX, e.clientY)
            if (draggingId === '__board__') {
                setBoardOffset({ x: pos.x - dragOffset.current.x, y: pos.y - dragOffset.current.y })
            } else {
                onComponentsChange(placedComponents.map(c =>
                    c.id === draggingId ? { ...c, x: pos.x - dragOffset.current.x, y: pos.y - dragOffset.current.y } : c
                ))
            }
            return
        }
        // Handle panning
        if (!isPanning.current || !svgRef.current) return
        const rect = svgRef.current.getBoundingClientRect()
        const dx = (e.clientX - panStart.current.x) * (viewBox.w / rect.width)
        const dy = (e.clientY - panStart.current.y) * (viewBox.h / rect.height)
        setViewBox((vb) => ({ ...vb, x: vb.x - dx, y: vb.y - dy }))
        panStart.current = { x: e.clientX, y: e.clientY }
    }, [draggingId, screenToSVG, onComponentsChange, placedComponents, viewBox.w, viewBox.h])

    const handleMouseUp = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (draggingId) {
            setDraggingId(null)
            return
        }
        isPanning.current = false
        e.currentTarget.style.cursor = placementMode ? 'crosshair' : 'grab'
    }, [draggingId, placementMode])

    // ===== Place component on click =====
    const handleSVGClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!placementMode) {
            // Deselect when clicking empty area
            setSelectedComponentId(null)
            return
        }
        const pos = screenToSVG(e.clientX, e.clientY)
        const newComp: PlacedComponent = {
            id: nextId(),
            type: placementMode.type,
            x: pos.x,
            y: pos.y,
            color: placementMode.color,
            label: placementMode.label,
            on: false,
        }
        onComponentsChange([...placedComponents, newComp])
        // Exit placement mode after placing one component
        setPlacementMode(null)
    }, [placementMode, screenToSVG, onComponentsChange, placedComponents])

    // ===== Component drag start =====
    const handleComponentDragStart = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const comp = placedComponents.find(c => c.id === id)
        if (!comp) return
        const pos = screenToSVG(e.clientX, e.clientY)
        dragOffset.current = { x: pos.x - comp.x, y: pos.y - comp.y }
        setDraggingId(id)
    }, [placedComponents, screenToSVG])

    // ===== Toggle component ON/OFF =====


    // ===== Select palette item =====
    const handlePaletteSelect = useCallback((item: PaletteCategory['items'][0]) => {
        setPlacementMode({ type: item.type, color: item.defaultColor, label: item.label })
        setShowPalette(false)
    }, [])

    // ===== Cancel placement mode =====
    const cancelPlacement = useCallback(() => {
        setPlacementMode(null)
    }, [])

    // ===== Handle component selection (or delete in delete mode) =====
    const handleComponentSelect = useCallback((id: string) => {
        if (deleteMode) {
            onComponentsChange(placedComponents.filter(c => c.id !== id))
            return
        }
        setSelectedComponentId(id)
    }, [deleteMode, onComponentsChange, placedComponents])

    const handleReset = useCallback(() => {
        setViewBox(DEFAULT_VB)
    }, [])

    // Keyboard: Delete/Backspace to remove selected component
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedComponentId) {
                if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
                e.preventDefault()
                onComponentsChange(placedComponents.filter(c => c.id !== selectedComponentId))
                setSelectedComponentId(null)
            }
            // Escape to cancel placement mode, delete mode, or deselect
            if (e.key === 'Escape') {
                if (deleteMode) setDeleteMode(false)
                else if (placementMode) setPlacementMode(null)
                else setSelectedComponentId(null)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedComponentId, onComponentsChange, placedComponents, placementMode, deleteMode])

    // Prevent default wheel on container
    useEffect(() => {
        const container = svgRef.current?.parentElement
        if (!container) return
        const prevent = (e: WheelEvent) => e.preventDefault()
        container.addEventListener('wheel', prevent, { passive: false })
        return () => container.removeEventListener('wheel', prevent)
    }, [])

    // Determine cursor based on mode
    const svgCursor = deleteMode ? 'not-allowed' : placementMode ? 'crosshair' : draggingId ? 'grabbing' : 'grab'

    return (
        <div className="board-container">
            {/* Top-left: Add Component button */}
            <div className="board-add">
                <button
                    className={`board-add__btn ${placementMode ? 'board-add__btn--active' : ''}`}
                    onClick={() => {
                        if (placementMode) { cancelPlacement() }
                        else { setShowPalette(!showPalette) }
                    }}
                    title={placementMode ? 'Cancel placement' : 'Add component'}
                >
                    {placementMode ? '✕' : '+'}
                </button>

                {/* Delete mode toggle */}
                <button
                    className={`board-add__btn board-add__btn--delete ${deleteMode ? 'board-add__btn--active-delete' : ''}`}
                    onClick={() => {
                        setDeleteMode(!deleteMode)
                        setPlacementMode(null)
                        setShowPalette(false)
                        setSelectedComponentId(null)
                    }}
                    title={deleteMode ? 'Cancel delete mode' : 'Delete components'}
                >
                    🗑
                </button>

                {/* Palette dropdown */}
                {showPalette && (
                    <div className="board-palette">
                        <div className="board-palette__title">Add Component</div>
                        {PALETTE_CATEGORIES.map((cat, ci) => (
                            <div key={ci} className="board-palette__category">
                                <div className="board-palette__category-title">{cat.title}</div>
                                {cat.items.map((item, i) => (
                                    <button key={i} className="board-palette__item" onClick={() => handlePaletteSelect(item)}>
                                        <span>{item.icon}</span>
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Placement mode indicator */}
            {placementMode && (
                <div className="board-placement-hint">
                    Click on board to place <strong>{placementMode.label}</strong>
                    <button className="board-placement-hint__cancel" onClick={cancelPlacement}>Cancel</button>
                </div>
            )}

            {/* Delete mode indicator */}
            {deleteMode && (
                <div className="board-placement-hint board-placement-hint--delete">
                    🗑 Click a component to delete it
                    <button className="board-placement-hint__cancel" onClick={() => setDeleteMode(false)}>Cancel (Esc)</button>
                </div>
            )}

            {/* Zoom controls */}
            <div className="board-controls">
                <button className="board-controls__btn" onClick={() => setViewBox(vb => {
                    const f = 0.85; const newW = vb.w * f; const newH = vb.h * f
                    if (BOARD_WIDTH / newW > MAX_ZOOM) return vb
                    return { x: vb.x + (vb.w - newW) / 2, y: vb.y + (vb.h - newH) / 2, w: newW, h: newH }
                })} title="Zoom in">+</button>
                <span className="board-controls__zoom">{zoomPercent}%</span>
                <button className="board-controls__btn" onClick={() => setViewBox(vb => {
                    const f = 1.15; const newW = vb.w * f; const newH = vb.h * f
                    if (BOARD_WIDTH / newW < MIN_ZOOM) return vb
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
                onClick={handleSVGClick}
                style={{ cursor: svgCursor }}
            >
                {/* ===== Draggable Board Group ===== */}
                <g
                    transform={`translate(${boardOffset.x}, ${boardOffset.y})`}
                    style={{ cursor: draggingId === '__board__' ? 'grabbing' : 'grab' }}
                    onMouseDown={(e) => {
                        if (e.button !== 0 || placementMode) return
                        e.stopPropagation()
                        const pos = screenToSVG(e.clientX, e.clientY)
                        dragOffset.current = { x: pos.x - boardOffset.x, y: pos.y - boardOffset.y }
                        setDraggingId('__board__')
                        setSelectedComponentId(null)
                    }}
                >
                    {/* Board PCB body */}
                    <rect x={PCB_LEFT} y={12} width={PCB_WIDTH} height={BOARD_HEIGHT - 24}
                        rx={12} fill="#1a3a2a" stroke="#2d5a3d" strokeWidth={2} />
                    <rect x={PCB_LEFT + 7} y={20} width={PCB_WIDTH - 14} height={BOARD_HEIGHT - 40}
                        rx={8} fill="#0d2818" opacity={0.6} />

                    {/* USB-C */}
                    <rect x={BOARD_WIDTH / 2 - 30} y={6} width={60} height={18} rx={4} fill="#888" stroke="#aaa" strokeWidth={1} />
                    <rect x={BOARD_WIDTH / 2 - 20} y={10} width={40} height={10} rx={2} fill="#555" />
                    <text x={BOARD_WIDTH / 2} y={17} textAnchor="middle" fontSize={6} fill="#ccc" fontFamily="'Inter', sans-serif">USB-C</text>

                    {/* Chip */}
                    <rect x={BOARD_WIDTH / 2 - 60} y={200} width={120} height={120} rx={4} fill="#222" stroke="#444" strokeWidth={1.5} />
                    <rect x={BOARD_WIDTH / 2 - 52} y={208} width={104} height={104} rx={2} fill="#1a1a1a" />
                    <text x={BOARD_WIDTH / 2} y={252} textAnchor="middle" fontSize={11} fontWeight="bold" fontFamily="'Inter', sans-serif" fill="#4ecca3">ESP32-S3</text>
                    <text x={BOARD_WIDTH / 2} y={268} textAnchor="middle" fontSize={8} fontFamily="'Inter', sans-serif" fill="#666">WROOM-1</text>

                    {/* Antenna */}
                    <rect x={BOARD_WIDTH / 2 - 35} y={40} width={70} height={50} rx={3} fill="none" stroke="#4ecca355" strokeWidth={1} strokeDasharray="3 2" />
                    <text x={BOARD_WIDTH / 2} y={70} textAnchor="middle" fontSize={7} fontFamily="'Inter', sans-serif" fill="#4ecca355">ANTENNA</text>

                    {/* Buttons */}
                    <rect x={PCB_LEFT + 20} y={370} width={24} height={14} rx={3} fill="#333" stroke="#555" strokeWidth={1} />
                    <text x={PCB_LEFT + 32} y={395} textAnchor="middle" fontSize={6} fill="#888" fontFamily="'Inter', sans-serif">BOOT</text>
                    <rect x={BOARD_WIDTH - PCB_LEFT - 44} y={370} width={24} height={14} rx={3} fill="#333" stroke="#555" strokeWidth={1} />
                    <text x={BOARD_WIDTH - PCB_LEFT - 32} y={395} textAnchor="middle" fontSize={6} fill="#888" fontFamily="'Inter', sans-serif">RST</text>

                    {/* Built-in LEDs */}
                    <circle cx={BOARD_WIDTH - PCB_LEFT - 30} cy={440} r={5} fill={pinStates.get(48)?.state === 'HIGH' ? '#4ecca3' : '#222'} stroke="#4ecca3" strokeWidth={1} />
                    <text x={BOARD_WIDTH - PCB_LEFT - 30} y={455} textAnchor="middle" fontSize={6} fill="#666" fontFamily="'Inter', sans-serif">LED</text>
                    <circle cx={PCB_LEFT + 30} cy={440} r={4} fill="#e9456066" stroke="#e94560" strokeWidth={1} />
                    <text x={PCB_LEFT + 30} y={455} textAnchor="middle" fontSize={6} fill="#666" fontFamily="'Inter', sans-serif">PWR</text>

                    {/* Pins */}
                    {LEFT_PINS.map((pin, i) => (
                        <PinCircle key={`left-${i}`} pin={pin} x={LEFT_PIN_X} y={PIN_START_Y + i * PIN_SPACING}
                            side="left" pinStates={pinStates} selectedPin={selectedPin} onPinClick={onPinClick}
                            hoveredPin={hoveredPin} onHover={setHoveredPin} />
                    ))}
                    {RIGHT_PINS.map((pin, i) => (
                        <PinCircle key={`right-${i}`} pin={pin} x={RIGHT_PIN_X} y={PIN_START_Y + i * PIN_SPACING}
                            side="right" pinStates={pinStates} selectedPin={selectedPin} onPinClick={onPinClick}
                            hoveredPin={hoveredPin} onHover={setHoveredPin} />
                    ))}

                    {/* Board label */}
                    <text x={BOARD_WIDTH / 2} y={BOARD_HEIGHT - 18} textAnchor="middle" fontSize={8} fontFamily="'Inter', sans-serif" fill="#4ecca355">
                        ESP32-S3-DevKitC-1
                    </text>
                </g>

                {/* Placed Components (independent of board position) */}
                {placedComponents.map(comp => {
                    if (comp.type === 'led') return (
                        <PlacedLED
                            key={comp.id}
                            comp={comp}
                            onDragStart={deleteMode ? () => { } : handleComponentDragStart}
                            onSelect={handleComponentSelect}
                            isDragging={draggingId === comp.id}
                            isSelected={selectedComponentId === comp.id}
                        />
                    )
                    if (comp.type === 'button') return (
                        <PlacedButton
                            key={comp.id}
                            comp={comp}
                            onDragStart={deleteMode ? () => { } : handleComponentDragStart}
                            onSelect={handleComponentSelect}
                            onPress={deleteMode ? () => { } : (id, pressed) => {
                                onComponentsChange(placedComponents.map(c =>
                                    c.id === id ? { ...c, on: pressed } : c
                                ))
                            }}
                            isDragging={draggingId === comp.id}
                            isSelected={selectedComponentId === comp.id}
                        />
                    )
                    return null
                })}
            </svg>
        </div>
    )
}
