import React, { useState, useRef, useCallback, useEffect } from 'react'
import { LEFT_PINS, RIGHT_PINS } from './pinDefinitions'
import type { PinState, PinDefinition } from './pinDefinitions'
import { BuzzerAudio } from '../simulator/buzzer'

// ===== Placed Component Types =====

export type ComponentType = 'led' | 'button' | 'oled' | 'buzzer' | 'potentiometer'

export interface PlacedComponent {
    id: string
    type: ComponentType
    x: number
    y: number
    color: string
    label: string
    on: boolean  // LED: lit state, Button: pressed state, OLED: power state
    screenText?: string  // OLED: text to display
    value?: number       // Potentiometer: analog value 0-4095
}

// ===== Wire Types =====

export interface Wire {
    id: string
    fromPin: number       // GPIO number
    toComponentId: string // Component ID
    toComponentPin: string // Component Pin identifier
    color: string         // Wire color
    midX?: number         // Custom X position of the vertical segment
}

const WIRE_COLORS = ['#e94560', '#4ecca3', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

// ===== Component Pin Constants =====
export function getComponentPinOffset(type: ComponentType, pinId: string): { x: number; y: number } {
    if (type === 'led') {
        const r = 38
        // Right = anode (+) long leg, left = cathode (−) short leg — matches your LED
        if (pinId === 'anode') return { x: 7.5, y: r + 30 }
        if (pinId === 'cathode') return { x: -7.5, y: r + 24 }
    } else if (type === 'button') {
        if (pinId === 'tl') return { x: -48, y: -8.5 }
        if (pinId === 'tr') return { x: 48, y: -8.5 }
        if (pinId === 'bl') return { x: -48, y: 9.5 }
        if (pinId === 'br') return { x: 48, y: 9.5 }
    } else if (type === 'buzzer') {
        if (pinId === 'positive') return { x: -6, y: 42 }
        if (pinId === 'negative') return { x: 6, y: 42 }
    } else if (type === 'potentiometer') {
        if (pinId === 'vcc') return { x: -16, y: 44 }
        if (pinId === 'sig') return { x: 0, y: 44 }
        if (pinId === 'gnd') return { x: 16, y: 44 }
    } else if (type === 'oled') {
        const y = 55 // h/2 + 5
        if (pinId === 'gnd') return { x: -30, y }
        if (pinId === 'vcc') return { x: -10, y }
        if (pinId === 'scl') return { x: 10, y }
        if (pinId === 'sda') return { x: 30, y }
    }
    return { x: 0, y: 0 }
}

// ===== Props Interface =====

export interface BoardProps {
    pinStates: Map<number, PinState>
    onPinClick?: (gpio: number) => void
    selectedPin?: number | null
    /** Placed components on the board */
    placedComponents: PlacedComponent[]
    onComponentsChange: (components: PlacedComponent[]) => void
    /** Wires connecting pins to components */
    wires: Wire[]
    onWiresChange: (wires: Wire[]) => void
    /** Fired when a placed button drives a GPIO — sends the resolved state */
    onButtonPress?: (gpio: number, state: 'HIGH' | 'LOW') => void
    /** OLED display pixel buffer (128×64, each byte 0 or 1) from simulation */
    displayBuffer?: Uint8Array | null
    /** Active buzzer tone from simulation (pin + frequency), null when silent */
    activeTone?: { pin: number; frequency: number } | null
    /** Fired when a potentiometer value changes on a wired GPIO */
    onAnalogChange?: (gpio: number, value: number) => void
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
    const isPower = !!pin.isPower
    const labelX = side === 'left' ? x - LABEL_OFFSET : x + LABEL_OFFSET
    const textAnchor = side === 'left' ? 'end' : 'start'

    return (
        <g
            style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onPinClick?.(pin.gpio) }}
            onMouseEnter={() => onHover(pin.gpio)}
            onMouseLeave={() => onHover(null)}
        >
            <circle
                cx={x} cy={y}
                r={isHovered ? PIN_RADIUS + 2 : PIN_RADIUS}
                fill={color}
                stroke={isHovered ? '#fff' : 'none'}
                strokeWidth={isHovered ? 2 : 0}
                style={{ transition: 'all 0.15s ease', filter: isHovered ? `drop-shadow(0 0 6px ${color})` : 'none' }}
            />
            <text x={labelX} y={y + 1} textAnchor={textAnchor} dominantBaseline="middle"
                fontSize={9} fontFamily="'JetBrains Mono', monospace"
                fill={isHovered ? '#fff' : '#888'} style={{ transition: 'fill 0.15s ease', userSelect: 'none' }}>
                {pin.label}
            </text>
            {isHovered && !isPower && (
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

// ===== LED: derive lit state — requires complete circuit =====
// A real LED needs current flow: anode (+) must be HIGH and cathode (−) must be LOW.
// This means BOTH legs must be wired for the LED to turn on.
const VCC_PINS = [-1, -2, -4, -8] // 3V3, 5V power pins
const GND_PINS = [-5, -6, -7]     // GND pins

function isAnodeHigh(fromPin: number, pinStates: Map<number, PinState>): boolean {
    if (VCC_PINS.includes(fromPin)) return true
    if (fromPin >= 0 && pinStates.get(fromPin)?.state === 'HIGH') return true
    return false
}

function isCathodeLow(fromPin: number, pinStates: Map<number, PinState>): boolean {
    if (GND_PINS.includes(fromPin)) return true
    if (fromPin >= 0 && pinStates.get(fromPin)?.state === 'LOW') return true
    return false
}

function getLedOnFromWires(
    compId: string,
    wires: Wire[],
    pinStates: Map<number, PinState>
): boolean {
    const ledWires = wires.filter(w => w.toComponentId === compId)
    const anodeWire = ledWires.find(w => w.toComponentPin === 'anode')
    const cathodeWire = ledWires.find(w => w.toComponentPin === 'cathode')

    // Both legs must be wired for a complete circuit
    if (!anodeWire || !cathodeWire) return false

    const aHigh = isAnodeHigh(anodeWire.fromPin, pinStates)
    const cLow = isCathodeLow(cathodeWire.fromPin, pinStates)

    return aHigh && cLow
}

// ===== Button: resolve circuit when pressed =====
// Real tactile switch: TL-BL always connected (left node), TR-BR always connected (right node).
// Pressing bridges left ↔ right. A complete circuit needs GPIO on one side, power on the other.
const BUTTON_LEFT = ['tl', 'bl']
const BUTTON_RIGHT = ['tr', 'br']

interface ButtonEffect { gpioPin: number; pressedState: 'HIGH' | 'LOW' }

function getButtonCircuitEffects(compId: string, wires: Wire[]): ButtonEffect[] {
    const btnWires = wires.filter(w => w.toComponentId === compId)
    const leftWires = btnWires.filter(w => BUTTON_LEFT.includes(w.toComponentPin))
    const rightWires = btnWires.filter(w => BUTTON_RIGHT.includes(w.toComponentPin))

    const leftGPIOs = leftWires.filter(w => w.fromPin >= 0).map(w => w.fromPin)
    const rightGPIOs = rightWires.filter(w => w.fromPin >= 0).map(w => w.fromPin)
    const leftHasVCC = leftWires.some(w => VCC_PINS.includes(w.fromPin))
    const leftHasGND = leftWires.some(w => GND_PINS.includes(w.fromPin))
    const rightHasVCC = rightWires.some(w => VCC_PINS.includes(w.fromPin))
    const rightHasGND = rightWires.some(w => GND_PINS.includes(w.fromPin))

    const effects: ButtonEffect[] = []

    for (const gpio of leftGPIOs) {
        if (rightHasVCC) effects.push({ gpioPin: gpio, pressedState: 'HIGH' })
        else if (rightHasGND) effects.push({ gpioPin: gpio, pressedState: 'LOW' })
    }
    for (const gpio of rightGPIOs) {
        if (leftHasVCC) effects.push({ gpioPin: gpio, pressedState: 'HIGH' })
        else if (leftHasGND) effects.push({ gpioPin: gpio, pressedState: 'LOW' })
    }

    return effects
}

// ===== OLED: requires VCC + GND + SCL (GPIO) + SDA (GPIO) for complete I2C circuit =====
function isOledWiredCorrectly(compId: string, wires: Wire[]): boolean {
    const oledWires = wires.filter(w => w.toComponentId === compId)
    const gndWire = oledWires.find(w => w.toComponentPin === 'gnd')
    const vccWire = oledWires.find(w => w.toComponentPin === 'vcc')
    const sclWire = oledWires.find(w => w.toComponentPin === 'scl')
    const sdaWire = oledWires.find(w => w.toComponentPin === 'sda')

    if (!gndWire || !vccWire || !sclWire || !sdaWire) return false

    const gndOk = GND_PINS.includes(gndWire.fromPin)
    const vccOk = VCC_PINS.includes(vccWire.fromPin)
    const sclOk = sclWire.fromPin >= 0 // Must be a GPIO
    const sdaOk = sdaWire.fromPin >= 0 // Must be a GPIO

    return gndOk && vccOk && sclOk && sdaOk
}

// ===== Buzzer: derive active state — requires complete circuit + tone or HIGH =====
interface BuzzerState { active: boolean; frequency: number }

function getBuzzerStateFromWires(
    compId: string,
    wires: Wire[],
    pinStates: Map<number, PinState>,
    activeTone?: { pin: number; frequency: number } | null,
): BuzzerState {
    const bWires = wires.filter(w => w.toComponentId === compId)
    const posWire = bWires.find(w => w.toComponentPin === 'positive')
    const negWire = bWires.find(w => w.toComponentPin === 'negative')

    if (!posWire || !negWire) return { active: false, frequency: 0 }

    // Negative pin must go to GND
    const negOk = GND_PINS.includes(negWire.fromPin)
    if (!negOk) return { active: false, frequency: 0 }

    const posPin = posWire.fromPin

    // Positive pin connected to VCC → always on (active buzzer, default freq)
    if (VCC_PINS.includes(posPin)) return { active: true, frequency: 1000 }

    // Positive pin connected to GPIO
    if (posPin >= 0) {
        // Check if tone() is active on this GPIO
        if (activeTone && activeTone.pin === posPin) {
            return { active: true, frequency: activeTone.frequency }
        }
        // Fallback: check if GPIO is HIGH (digitalWrite)
        if (pinStates.get(posPin)?.state === 'HIGH') {
            return { active: true, frequency: 1000 }
        }
    }

    return { active: false, frequency: 0 }
}

// ===== Potentiometer: check wiring and return connected GPIO for SIG pin =====
function getPotWiredGpio(compId: string, wires: Wire[]): number | null {
    const pWires = wires.filter(w => w.toComponentId === compId)
    const vccWire = pWires.find(w => w.toComponentPin === 'vcc')
    const gndWire = pWires.find(w => w.toComponentPin === 'gnd')
    const sigWire = pWires.find(w => w.toComponentPin === 'sig')

    if (!vccWire || !gndWire || !sigWire) return null

    const vccOk = VCC_PINS.includes(vccWire.fromPin)
    const gndOk = GND_PINS.includes(gndWire.fromPin)
    if (!vccOk || !gndOk) return null

    // SIG must connect to a real GPIO (not power/gnd)
    if (sigWire.fromPin >= 0) return sigWire.fromPin
    return null
}

// ===== Placed LED SVG Element =====
interface PlacedLEDProps {
    comp: PlacedComponent
    /** Derived from wired GPIO: HIGH on anode pin = lit */
    isOn: boolean
    onDragStart: (id: string, e: React.MouseEvent) => void
    onSelect: (id: string) => void
    isDragging: boolean
    isSelected: boolean
    wiringMode: boolean
    onPinClick: (compId: string, pinId: string) => void
}

function PlacedLED({ comp, isOn, onDragStart, onSelect, isDragging, isSelected, wiringMode, onPinClick }: PlacedLEDProps) {
    const r = 38
    return (
        <g
            transform={`translate(${comp.x}, ${comp.y})`}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={(e) => { e.stopPropagation(); onSelect(comp.id); onDragStart(comp.id, e) }}
        >
            {/* Selection ring */}
            {isSelected && (
                <circle cx={0} cy={0} r={r + 12} fill="none" stroke="#3b82f6" strokeWidth={2.5}
                    strokeDasharray="6 4" opacity={0.8}>
                    <animate attributeName="stroke-dashoffset" values="0;20" dur="1s" repeatCount="indefinite" />
                </circle>
            )}

            {/* Glow when ON — opacity animation for brightness effect */}
            {isOn && (
                <circle cx={0} cy={0} r={r + 20} fill={comp.color}
                    style={{ filter: 'blur(10px)' }}>
                    <animate attributeName="opacity" values="0.35;0.12;0.35" dur="1.5s" repeatCount="indefinite" />
                </circle>
            )}

            {/* LED base (dark ring) */}
            <circle cx={0} cy={0} r={r + 5} fill="#1a1a2e" stroke="#444" strokeWidth={2.5} />

            {/* LED dome — color from prop, opacity animation when lit */}
            <circle cx={0} cy={0} r={r} fill={isOn ? comp.color : '#333'}
                stroke={isOn ? comp.color : '#555'} strokeWidth={2}
                opacity={isOn ? 0.9 : 0.25}>
                {isOn && (
                    <animate attributeName="opacity" values="0.85;1;0.85" dur="1.2s" repeatCount="indefinite" />
                )}
            </circle>

            {/* Tinted dome hint (show what color when off) */}
            {!isOn && (
                <circle cx={0} cy={0} r={r} fill={comp.color} opacity={0.08} />
            )}

            {/* Highlight reflection */}
            <ellipse cx={-8} cy={-10} rx={12} ry={8} fill="white" opacity={isOn ? 0.35 : 0.25} />

            {/* Metal legs */}
            <rect x={-10} y={r + 5} width={5} height={22} fill="#999" rx={1.5} />
            <rect x={5} y={r + 5} width={5} height={28} fill="#999" rx={1.5} />

            {/* Connection Pins — right: anode (+) long leg, left: cathode (−) short leg */}
            <g>
                <circle cx={-7.5} cy={r + 24} r={8} fill="#e5e7eb" stroke="#6b7280" strokeWidth={1.5}
                    cursor={wiringMode ? "crosshair" : "default"}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onPinClick(comp.id, 'cathode') }} />
                <text x={-7.5} y={r + 38} textAnchor="middle" fontSize={7} fill="#888" fontFamily="'Inter', sans-serif">− GND</text>
            </g>
            <g>
                <circle cx={7.5} cy={r + 30} r={8} fill="#e5e7eb" stroke="#6b7280" strokeWidth={1.5}
                    cursor={wiringMode ? "crosshair" : "default"}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onPinClick(comp.id, 'anode') }} />
                <text x={7.5} y={r + 44} textAnchor="middle" fontSize={7} fill="#888" fontFamily="'Inter', sans-serif">+ 5V/GPIO</text>
            </g>
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
    wiringMode: boolean
    onPinClick: (compId: string, pinId: string) => void
}

function PlacedButton({ comp, onDragStart, onSelect, onPress, isDragging, isSelected, wiringMode, onPinClick }: PlacedButtonProps) {
    const w = 90
    const h = 70
    const capColor = comp.color

    return (
        <g
            transform={`translate(${comp.x}, ${comp.y})`}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={(e) => { e.stopPropagation(); onSelect(comp.id); onDragStart(comp.id, e) }}
        >
            {/* Selection ring */}
            {isSelected && (
                <rect x={-w / 2 - 8} y={-h / 2 - 8} width={w + 16} height={h + 16} rx={8}
                    fill="none" stroke="#3b82f6" strokeWidth={2.5}
                    strokeDasharray="6 4" opacity={0.8}>
                    <animate attributeName="stroke-dashoffset" values="0;20" dur="1s" repeatCount="indefinite" />
                </rect>
            )}

            {/* Button housing (black body) */}
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={6}
                fill="#1a1a1a" stroke="#444" strokeWidth={2.5} />

            {/* Inner cavity */}
            <rect x={-w / 2 + 8} y={-h / 2 + 8} width={w - 16} height={h - 16} rx={4}
                fill="#111" />

            {/* Button cap (plunger) */}
            <rect
                x={-w / 2 + 14} y={comp.on ? -h / 2 + 18 : -h / 2 + 13}
                width={w - 28} height={h - 28} rx={4}
                fill={capColor}
                stroke={comp.on ? '#fff3' : '#0003'}
                strokeWidth={2}
                opacity={comp.on ? 1 : 0.85}
            />
            {/* Cap highlight */}
            {!comp.on && (
                <rect x={-w / 2 + 18} y={-h / 2 + 15} width={w - 36} height={6} rx={3}
                    fill="white" opacity={0.2} />
            )}

            {/* 4 metal pins */}
            <rect x={-w / 2 - 8} y={-12} width={10} height={7} fill="#999" rx={1.5} />
            <rect x={-w / 2 - 8} y={6} width={10} height={7} fill="#999" rx={1.5} />
            <rect x={w / 2 - 2} y={-12} width={10} height={7} fill="#999" rx={1.5} />
            <rect x={w / 2 - 2} y={6} width={10} height={7} fill="#999" rx={1.5} />

            {/* Connection Pins — left side (tl/bl) always connected, right side (tr/br) always connected */}
            {[
                { id: 'tl', cx: -48, cy: -8.5 },
                { id: 'bl', cx: -48, cy: 9.5 },
                { id: 'tr', cx: 48, cy: -8.5 },
                { id: 'br', cx: 48, cy: 9.5 }
            ].map(pin => (
                <circle key={pin.id} cx={pin.cx} cy={pin.cy} r={8} fill="#e5e7eb" stroke="#6b7280" strokeWidth={1.5}
                    cursor={wiringMode ? "crosshair" : "default"}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onPinClick(comp.id, pin.id) }} />
            ))}
            {/* Side labels */}
            <text x={-48} y={24} textAnchor="middle" fontSize={6} fill="#888" fontFamily="'Inter', sans-serif">A</text>
            <text x={48} y={24} textAnchor="middle" fontSize={6} fill="#888" fontFamily="'Inter', sans-serif">B</text>

            {/* Press area — mousedown/up for tactile press feel */}
            <rect x={-w / 2 + 8} y={-h / 2 + 8} width={w - 16} height={h - 16} fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => { e.stopPropagation(); onPress(comp.id, true) }}
                onMouseUp={() => onPress(comp.id, false)}
                onMouseLeave={() => { if (comp.on) onPress(comp.id, false) }}
            />
        </g>
    )
}

// ===== Placed OLED Display SVG Element =====
interface PlacedOLEDProps {
    comp: PlacedComponent
    onDragStart: (id: string, e: React.MouseEvent) => void
    onSelect: (id: string) => void
    isDragging: boolean
    isSelected: boolean
    wiringMode: boolean
    onPinClick: (compId: string, pinId: string) => void
    displayBuffer?: Uint8Array | null
}

function PlacedOLED({ comp, onDragStart, onSelect, isDragging, isSelected, wiringMode, onPinClick, displayBuffer }: PlacedOLEDProps) {
    const w = 160
    const h = 100
    const screenW = 136
    const screenH = 68
    const screenX = -screenW / 2
    const screenY = -h / 2 + 10
    const [imgSrc, setImgSrc] = useState<string>('')

    // Render pixel buffer to an offscreen canvas → data URL for SVG <image>
    useEffect(() => {
        if (!displayBuffer || displayBuffer.length < 128 * 64) {
            setImgSrc('')
            return
        }
        const canvas = document.createElement('canvas')
        canvas.width = 128
        canvas.height = 64
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const imgData = ctx.createImageData(128, 64)
        for (let i = 0; i < 128 * 64; i++) {
            const idx = i * 4
            if (displayBuffer[i]) {
                imgData.data[idx] = 0       // R
                imgData.data[idx + 1] = 204 // G
                imgData.data[idx + 2] = 255 // B
                imgData.data[idx + 3] = 255 // A
            }
        }
        ctx.putImageData(imgData, 0, 0)
        setImgSrc(canvas.toDataURL())
    }, [displayBuffer])

    const hasBuffer = !!imgSrc

    return (
        <g
            transform={`translate(${comp.x}, ${comp.y})`}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={(e) => { e.stopPropagation(); onSelect(comp.id); onDragStart(comp.id, e) }}
        >
            {/* Selection ring */}
            {isSelected && (
                <rect x={-w / 2 - 8} y={-h / 2 - 8} width={w + 16} height={h + 16} rx={8}
                    fill="none" stroke="#3b82f6" strokeWidth={2.5}
                    strokeDasharray="6 4" opacity={0.8}>
                    <animate attributeName="stroke-dashoffset" values="0;20" dur="1s" repeatCount="indefinite" />
                </rect>
            )}

            {/* PCB board (blue) */}
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={5}
                fill="#0a3d6b" stroke="#0d4f8a" strokeWidth={2} />

            {/* PCB corner holes */}
            <circle cx={-w / 2 + 7} cy={-h / 2 + 7} r={2.5} fill="none" stroke="#0d4f8a" strokeWidth={1} />
            <circle cx={w / 2 - 7} cy={-h / 2 + 7} r={2.5} fill="none" stroke="#0d4f8a" strokeWidth={1} />
            <circle cx={-w / 2 + 7} cy={h / 2 - 7} r={2.5} fill="none" stroke="#0d4f8a" strokeWidth={1} />
            <circle cx={w / 2 - 7} cy={h / 2 - 7} r={2.5} fill="none" stroke="#0d4f8a" strokeWidth={1} />

            {/* Screen bezel (black frame) */}
            <rect x={screenX - 3} y={screenY - 3} width={screenW + 6} height={screenH + 6} rx={3}
                fill="#111" stroke="#333" strokeWidth={1} />

            {/* Screen background */}
            <rect x={screenX} y={screenY} width={screenW} height={screenH} rx={2}
                fill="#050505" />

            {/* Screen pixel grid texture */}
            <defs>
                <pattern id={`oled-grid-${comp.id}`} width="4" height="4" patternUnits="userSpaceOnUse">
                    <rect width="3.5" height="3.5" fill="#0a0a0a" />
                </pattern>
            </defs>
            <rect x={screenX} y={screenY} width={screenW} height={screenH} rx={2}
                fill={`url(#oled-grid-${comp.id})`} opacity={0.4} />

            {/* OLED pixel buffer rendered as SVG image */}
            {imgSrc && (
                <image
                    href={imgSrc}
                    x={screenX + 4} y={screenY + 2}
                    width={screenW - 8} height={screenH - 4}
                    preserveAspectRatio="none"
                    style={{ imageRendering: 'pixelated' }}
                />
            )}

            {/* Fallback text when no buffer data */}
            {!hasBuffer && (
                <>
                    <text x={0} y={screenY + 26} textAnchor="middle" fontSize={10}
                        fontFamily="'JetBrains Mono', monospace" fill="#00ccff" opacity={0.4}>
                        SSD1306 128×64
                    </text>
                    <text x={0} y={screenY + 44} textAnchor="middle" fontSize={7}
                        fontFamily="'JetBrains Mono', monospace" fill="#00ccff" opacity={0.25}>
                        I2C 0x3C
                    </text>
                </>
            )}

            {/* Scan line effect */}
            <rect x={screenX} y={screenY} width={screenW} height={2} fill="#ffffff" opacity={0.03}>
                <animate attributeName="y" values={`${screenY};${screenY + screenH}`} dur="3s" repeatCount="indefinite" />
            </rect>

            {/* 4 header pins at bottom */}
            {[-30, -10, 10, 30].map((px, i) => {
                const pinId = ['gnd', 'vcc', 'scl', 'sda'][i];
                return (
                    <g key={i}>
                        <rect x={px - 3} y={h / 2 - 3} width={6} height={16} fill="#c0a030" rx={1} />
                        <text x={px} y={h / 2 + 22} textAnchor="middle" fontSize={6}
                            fontFamily="'JetBrains Mono', monospace" fill="#888">
                            {pinId.toUpperCase()}
                        </text>
                        <circle cx={px} cy={h / 2 + 5} r={6} fill="#e5e7eb" stroke="#b48600" strokeWidth={1.5}
                            cursor={wiringMode ? "crosshair" : "default"}
                            onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); onPinClick(comp.id, pinId) }} />
                    </g>
                )
            })}

            {/* PCB text */}
            <text x={w / 2 - 8} y={h / 2 - 8} textAnchor="end" fontSize={6}
                fontFamily="'Inter', sans-serif" fill="#1a6fb0" opacity={0.8}>SSD1306</text>
        </g>
    )
}

// ===== Placed Buzzer SVG Element =====
interface PlacedBuzzerProps {
    comp: PlacedComponent
    buzzerState: BuzzerState
    onDragStart: (id: string, e: React.MouseEvent) => void
    onSelect: (id: string) => void
    isDragging: boolean
    isSelected: boolean
    wiringMode: boolean
    onPinClick: (compId: string, pinId: string) => void
}

function PlacedBuzzer({ comp, buzzerState, onDragStart, onSelect, isDragging, isSelected, wiringMode, onPinClick }: PlacedBuzzerProps) {
    const r = 30
    const { active, frequency } = buzzerState

    return (
        <g
            transform={`translate(${comp.x}, ${comp.y})`}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={(e) => { e.stopPropagation(); onSelect(comp.id); onDragStart(comp.id, e) }}
        >
            {/* Selection ring */}
            {isSelected && (
                <circle cx={0} cy={0} r={r + 12} fill="none" stroke="#3b82f6" strokeWidth={2.5}
                    strokeDasharray="6 4" opacity={0.8}>
                    <animate attributeName="stroke-dashoffset" values="0;20" dur="1s" repeatCount="indefinite" />
                </circle>
            )}

            {/* Glow when active */}
            {active && (
                <circle cx={0} cy={0} r={r + 18} fill="#f59e0b"
                    style={{ filter: 'blur(12px)' }}>
                    <animate attributeName="opacity" values="0.25;0.08;0.25" dur="0.6s" repeatCount="indefinite" />
                </circle>
            )}

            {/* Buzzer body (outer ring) */}
            <circle cx={0} cy={0} r={r + 4} fill="#1a1a2e" stroke="#555" strokeWidth={2} />

            {/* Buzzer top surface */}
            <circle cx={0} cy={0} r={r} fill={active ? '#2a2a3e' : '#222'}
                stroke={active ? '#f59e0b' : '#444'} strokeWidth={1.5} />

            {/* Sound hole (center) */}
            <circle cx={0} cy={0} r={6} fill={active ? '#f59e0b' : '#333'}
                stroke="#555" strokeWidth={1} opacity={active ? 0.9 : 0.5}>
                {active && (
                    <animate attributeName="opacity" values="0.9;0.5;0.9" dur="0.3s" repeatCount="indefinite" />
                )}
            </circle>

            {/* Concentric grooves */}
            {[12, 20, 27].map(gr => (
                <circle key={gr} cx={0} cy={0} r={gr} fill="none"
                    stroke={active ? '#f59e0b' : '#444'} strokeWidth={0.5}
                    opacity={active ? 0.4 : 0.2} />
            ))}

            {/* + marker on body */}
            <text x={-14} y={-r + 10} textAnchor="middle" fontSize={10} fill="#aaa"
                fontFamily="'Inter', sans-serif" fontWeight="bold">+</text>

            {/* Sound wave arcs when active */}
            {active && [1, 2, 3].map(i => (
                <path key={i}
                    d={`M ${r + 6 + i * 7} -8 Q ${r + 10 + i * 7} 0 ${r + 6 + i * 7} 8`}
                    fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeLinecap="round">
                    <animate attributeName="opacity" values="0.7;0.1;0.7"
                        dur={`${0.4 + i * 0.15}s`} repeatCount="indefinite" />
                </path>
            ))}

            {/* Frequency label */}
            <text x={0} y={r + 55} textAnchor="middle" fontSize={7}
                fontFamily="'JetBrains Mono', monospace"
                fill={active ? '#f59e0b' : '#666'}>
                {active ? `${frequency} Hz` : 'SILENT'}
            </text>

            {/* Metal legs */}
            <rect x={-8} y={r + 2} width={4} height={16} fill="#999" rx={1} />
            <rect x={4} y={r + 2} width={4} height={16} fill="#999" rx={1} />

            {/* Connection pins: left = positive (+), right = negative (−) */}
            <g>
                <circle cx={-6} cy={r + 12} r={7} fill="#e5e7eb" stroke="#b48600" strokeWidth={1.5}
                    cursor={wiringMode ? "crosshair" : "default"}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onPinClick(comp.id, 'positive') }} />
                <text x={-6} y={r + 26} textAnchor="middle" fontSize={6} fill="#888"
                    fontFamily="'Inter', sans-serif">+ SIG</text>
            </g>
            <g>
                <circle cx={6} cy={r + 12} r={7} fill="#e5e7eb" stroke="#6b7280" strokeWidth={1.5}
                    cursor={wiringMode ? "crosshair" : "default"}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onPinClick(comp.id, 'negative') }} />
                <text x={6} y={r + 26} textAnchor="middle" fontSize={6} fill="#888"
                    fontFamily="'Inter', sans-serif">− GND</text>
            </g>
        </g>
    )
}

// ===== Placed Potentiometer SVG Element =====
interface PlacedPotentiometerProps {
    comp: PlacedComponent
    wiredGpio: number | null
    onDragStart: (id: string, e: React.MouseEvent) => void
    onSelect: (id: string) => void
    isDragging: boolean
    isSelected: boolean
    wiringMode: boolean
    onPinClick: (compId: string, pinId: string) => void
    onValueChange: (id: string, value: number) => void
}

function PlacedPotentiometer({ comp, wiredGpio, onDragStart, onSelect, isDragging, isSelected, wiringMode, onPinClick, onValueChange }: PlacedPotentiometerProps) {
    const r = 30
    const value = comp.value ?? 0
    const angle = -135 + (value / 4095) * 270
    const knobR = r * 0.38
    const draggingKnob = useRef(false)

    const handleKnobPointer = useCallback((e: React.PointerEvent) => {
        const svg = (e.target as SVGElement).ownerSVGElement
        if (!svg) return
        const pt = svg.createSVGPoint()
        pt.x = e.clientX
        pt.y = e.clientY
        const ctm = svg.getScreenCTM()
        if (!ctm) return
        const svgPt = pt.matrixTransform(ctm.inverse())
        const dx = svgPt.x - comp.x
        const dy = svgPt.y - comp.y
        const rad = Math.atan2(dx, -dy)
        const deg = rad * (180 / Math.PI)
        const clamped = Math.max(-135, Math.min(135, deg))
        const newValue = Math.round(((clamped + 135) / 270) * 4095)
        onValueChange(comp.id, newValue)
    }, [comp.x, comp.y, comp.id, onValueChange])

    return (
        <g
            transform={`translate(${comp.x}, ${comp.y})`}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={(e) => { e.stopPropagation(); onSelect(comp.id); onDragStart(comp.id, e) }}
        >
            {/* Selection ring */}
            {isSelected && (
                <circle cx={0} cy={0} r={r + 12} fill="none" stroke="#3b82f6" strokeWidth={2.5}
                    strokeDasharray="6 4" opacity={0.8}>
                    <animate attributeName="stroke-dashoffset" values="0;20" dur="1s" repeatCount="indefinite" />
                </circle>
            )}

            {/* Housing */}
            <circle cx={0} cy={0} r={r + 4} fill="#1a1a2e" stroke="#555" strokeWidth={2} />
            <circle cx={0} cy={0} r={r} fill={comp.color || '#1a3d6b'} stroke="#444" strokeWidth={1.5} />

            {/* Track arc (270 degree sweep) */}
            {(() => {
                const tR = r * 0.72
                const sA = -135 * (Math.PI / 180) - Math.PI / 2
                const eA = 135 * (Math.PI / 180) - Math.PI / 2
                const x1 = tR * Math.cos(sA), y1 = tR * Math.sin(sA)
                const x2 = tR * Math.cos(eA), y2 = tR * Math.sin(eA)
                return <path d={`M ${x1} ${y1} A ${tR} ${tR} 0 1 1 ${x2} ${y2}`}
                    fill="none" stroke="#444" strokeWidth={3} strokeLinecap="round" />
            })()}

            {/* Active arc */}
            {value > 0 && (() => {
                const tR = r * 0.72
                const sA = -135 * (Math.PI / 180) - Math.PI / 2
                const cA = angle * (Math.PI / 180) - Math.PI / 2
                const x1 = tR * Math.cos(sA), y1 = tR * Math.sin(sA)
                const x2 = tR * Math.cos(cA), y2 = tR * Math.sin(cA)
                const sweep = angle + 135
                const large = sweep > 180 ? 1 : 0
                return <path d={`M ${x1} ${y1} A ${tR} ${tR} 0 ${large} 1 ${x2} ${y2}`}
                    fill="none" stroke="#4ecca3" strokeWidth={3} strokeLinecap="round" />
            })()}

            {/* Tick marks */}
            {[-135, 0, 135].map((deg, i) => {
                const rad = deg * (Math.PI / 180) - Math.PI / 2
                const i1 = r * 0.82, o1 = r * 0.95
                return <line key={i}
                    x1={i1 * Math.cos(rad)} y1={i1 * Math.sin(rad)}
                    x2={o1 * Math.cos(rad)} y2={o1 * Math.sin(rad)}
                    stroke="#666" strokeWidth={1.5} />
            })}

            {/* Knob */}
            <circle cx={0} cy={0} r={knobR} fill="#333" stroke="#666" strokeWidth={1.5}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => {
                    e.stopPropagation()
                    draggingKnob.current = true
                    ;(e.target as Element).setPointerCapture(e.pointerId)
                    handleKnobPointer(e)
                }}
                onPointerMove={(e) => { if (draggingKnob.current) handleKnobPointer(e) }}
                onPointerUp={(e) => {
                    draggingKnob.current = false
                    ;(e.target as Element).releasePointerCapture(e.pointerId)
                }}
            />

            {/* Knob indicator */}
            <line x1={0} y1={0}
                x2={(knobR - 4) * Math.sin(angle * Math.PI / 180)}
                y2={-(knobR - 4) * Math.cos(angle * Math.PI / 180)}
                stroke="#4ecca3" strokeWidth={2.5} strokeLinecap="round"
                style={{ pointerEvents: 'none' }} />
            <circle cx={0} cy={0} r={3} fill="#4ecca3" style={{ pointerEvents: 'none' }} />

            {/* Value display */}
            <text x={0} y={r + 58} textAnchor="middle" fontSize={7}
                fontFamily="'JetBrains Mono', monospace"
                fill={wiredGpio !== null ? '#4ecca3' : '#666'}>
                {value} / 4095
            </text>

            {/* Metal legs */}
            <rect x={-18} y={r + 2} width={4} height={16} fill="#999" rx={1} />
            <rect x={-2} y={r + 2} width={4} height={16} fill="#999" rx={1} />
            <rect x={14} y={r + 2} width={4} height={16} fill="#999" rx={1} />

            {/* Connection pins: VCC, SIG, GND */}
            <g>
                <circle cx={-16} cy={r + 14} r={7} fill="#e5e7eb" stroke="#b48600" strokeWidth={1.5}
                    cursor={wiringMode ? "crosshair" : "default"}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onPinClick(comp.id, 'vcc') }} />
                <text x={-16} y={r + 28} textAnchor="middle" fontSize={5} fill="#888"
                    fontFamily="'Inter', sans-serif">VCC</text>
            </g>
            <g>
                <circle cx={0} cy={r + 14} r={7} fill="#e5e7eb" stroke="#4ecca3" strokeWidth={1.5}
                    cursor={wiringMode ? "crosshair" : "default"}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onPinClick(comp.id, 'sig') }} />
                <text x={0} y={r + 28} textAnchor="middle" fontSize={5} fill="#888"
                    fontFamily="'Inter', sans-serif">SIG</text>
            </g>
            <g>
                <circle cx={16} cy={r + 14} r={7} fill="#e5e7eb" stroke="#6b7280" strokeWidth={1.5}
                    cursor={wiringMode ? "crosshair" : "default"}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onPinClick(comp.id, 'gnd') }} />
                <text x={16} y={r + 28} textAnchor="middle" fontSize={5} fill="#888"
                    fontFamily="'Inter', sans-serif">GND</text>
            </g>
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
    {
        title: '🎛️ Sensors',
        items: [
            { type: 'potentiometer', label: 'Potentiometer', icon: '🎚️', defaultColor: '#1a3d6b' },
        ],
    },
    {
        title: '🔊 Buzzers',
        items: [
            { type: 'buzzer', label: 'Piezo Buzzer', icon: '🔔', defaultColor: '#1a1a1a' },
        ],
    },
    {
        title: '📺 Displays',
        items: [
            { type: 'oled', label: '0.96" OLED', icon: '🖥️', defaultColor: '#0a3d6b' },
        ],
    },
]

// ===== Main Board Component =====

const DEFAULT_VB = { x: 0, y: 0, w: BOARD_WIDTH, h: BOARD_HEIGHT }
const MIN_ZOOM = 0.3
const MAX_ZOOM = 3

let componentIdCounter = 0
function nextId() { return `comp-${++componentIdCounter}` }

const BUTTON_DEBOUNCE_MS = 30

export default function Board({ pinStates, onPinClick, selectedPin, placedComponents, onComponentsChange, wires, onWiresChange, onButtonPress, displayBuffer, activeTone, onAnalogChange }: BoardProps) {
    const [hoveredPin, setHoveredPin] = useState<number | null>(null)

    // Debounce state per button: tracks last fired state and timestamp per component
    const btnDebounce = useRef<Map<string, { state: boolean; time: number }>>(new Map())

    // Buzzer audio instance — single shared instance for the board
    const buzzerAudioRef = useRef<BuzzerAudio | null>(null)

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

    // Wiring mode
    const [wiringMode, setWiringMode] = useState(false)
    const [wiringFrom, setWiringFrom] = useState<{ pin: number; x: number; y: number } | null>(null)
    const [wiringMouse, setWiringMouse] = useState<{ x: number; y: number } | null>(null)
    const [draggingSegment, setDraggingSegment] = useState<{ wireId: string; offsetX: number } | null>(null)

    // Dragging & selecting — '__board__' is the special ID for the board itself
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null)
    const dragOffset = useRef({ x: 0, y: 0 })

    // Buzzer audio: play/stop based on wired buzzer components + activeTone
    useEffect(() => {
        const buzzerComps = placedComponents.filter(c => c.type === 'buzzer')
        let anyActive = false
        let freq = 1000

        for (const bc of buzzerComps) {
            const st = getBuzzerStateFromWires(bc.id, wires, pinStates, activeTone)
            if (st.active) {
                anyActive = true
                freq = st.frequency
                break
            }
        }

        if (anyActive) {
            if (!buzzerAudioRef.current) buzzerAudioRef.current = new BuzzerAudio()
            buzzerAudioRef.current.play(freq)
        } else {
            buzzerAudioRef.current?.stop()
        }

        return () => {
            buzzerAudioRef.current?.stop()
        }
    }, [placedComponents, wires, pinStates, activeTone])

    // Cleanup buzzer audio on unmount
    useEffect(() => {
        return () => {
            buzzerAudioRef.current?.dispose()
            buzzerAudioRef.current = null
        }
    }, [])

    // Convert screen coords to SVG coords (browser native - handles viewBox, zoom, preserveAspectRatio)
    const screenToSVG = useCallback((clientX: number, clientY: number) => {
        const svg = svgRef.current
        if (!svg) return { x: 0, y: 0 }
        const pt = svg.createSVGPoint()
        pt.x = clientX
        pt.y = clientY
        const ctm = svg.getScreenCTM()
        if (!ctm) return { x: 0, y: 0 }
        const svgPt = pt.matrixTransform(ctm.inverse())
        return { x: svgPt.x, y: svgPt.y }
    }, [])

    // ===== Zoom =====
    const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
        e.preventDefault()
        const zoomCenter = screenToSVG(e.clientX, e.clientY)
        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9
        setViewBox((vb) => {
            const newW = vb.w * zoomFactor
            const newH = vb.h * zoomFactor
            const newZoom = BOARD_WIDTH / newW
            if (newZoom < MIN_ZOOM || newZoom > MAX_ZOOM) return vb
            return {
                x: zoomCenter.x - (zoomCenter.x - vb.x) * (newW / vb.w),
                y: zoomCenter.y - (zoomCenter.y - vb.y) * (newH / vb.h),
                w: newW,
                h: newH
            }
        })
    }, [screenToSVG])
    // ===== Pin position helper =====
    const getPinPosition = useCallback((gpio: number): { x: number; y: number } | null => {
        for (let i = 0; i < LEFT_PINS.length; i++) {
            if (LEFT_PINS[i].gpio === gpio) {
                return { x: boardOffset.x + LEFT_PIN_X, y: boardOffset.y + PIN_START_Y + i * PIN_SPACING }
            }
        }
        for (let i = 0; i < RIGHT_PINS.length; i++) {
            if (RIGHT_PINS[i].gpio === gpio) {
                return { x: boardOffset.x + RIGHT_PIN_X, y: boardOffset.y + PIN_START_Y + i * PIN_SPACING }
            }
        }
        return null
    }, [boardOffset])

    // ===== Pan =====
    const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (e.button !== 0 || placementMode || draggingId) return
        isPanning.current = true
        panStart.current = { x: e.clientX, y: e.clientY }
        e.currentTarget.style.cursor = 'grabbing'
    }, [placementMode, draggingId])

    const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (draggingSegment) {
            const pos = screenToSVG(e.clientX, e.clientY)
            onWiresChange(wires.map(w => {
                if (w.id === draggingSegment.wireId) {
                    return { ...w, midX: pos.x - draggingSegment.offsetX }
                }
                return w
            }))
            return
        }
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
        // Handle panning (use screenToSVG for consistent coordinate conversion)
        if (!isPanning.current) return
        const start = screenToSVG(panStart.current.x, panStart.current.y)
        const curr = screenToSVG(e.clientX, e.clientY)
        setViewBox((vb) => ({ ...vb, x: vb.x - (curr.x - start.x), y: vb.y - (curr.y - start.y) }))
        panStart.current = { x: e.clientX, y: e.clientY }
    }, [draggingId, screenToSVG, onComponentsChange, placedComponents, draggingSegment, onWiresChange, wires, getPinPosition])

    const handleMouseUp = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (draggingSegment) {
            setDraggingSegment(null)
            return
        }
        if (draggingId) {
            setDraggingId(null)
            return
        }
        isPanning.current = false
        e.currentTarget.style.cursor = placementMode ? 'crosshair' : 'grab'
    }, [draggingId, placementMode, draggingSegment])

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
            // Escape to cancel placement mode, delete mode, wiring mode, or deselect
            if (e.key === 'Escape') {
                if (wiringFrom) { setWiringFrom(null); setWiringMouse(null) }
                else if (wiringMode) setWiringMode(false)
                else if (deleteMode) setDeleteMode(false)
                else if (placementMode) setPlacementMode(null)
                else setSelectedComponentId(null)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedComponentId, onComponentsChange, placedComponents, placementMode, deleteMode, wiringFrom, wiringMode])

    // ===== Wire pin click handler =====
    const handleWirePinClick = useCallback((gpio: number) => {
        if (!wiringMode) return false
        const pinPos = getPinPosition(gpio)
        if (!pinPos) return false

        if (!wiringFrom) {
            console.log('[WIRE] Start from board pin:', gpio, 'at', pinPos)
            setWiringFrom({ pin: gpio, x: pinPos.x, y: pinPos.y })
            return true
        }
        // If clicking same pin, cancel
        if (wiringFrom.pin === gpio) {
            console.log('[WIRE] Cancel — same pin clicked')
            setWiringFrom(null)
            setWiringMouse(null)
            return true
        }
        console.log('[WIRE] Pin-to-pin ignored, click a component pin next')
        return true
    }, [wiringMode, wiringFrom, getPinPosition])

    // ===== Wire component PIN click handler =====
    const handleWireComponentPinClick = useCallback((compId: string, pinId: string) => {
        console.log('[WIRE] Component pin clicked:', compId, pinId,
            'wiringMode:', wiringMode, 'wiringFrom:', wiringFrom)
        if (!wiringMode || !wiringFrom) return false
        // Check if wire already exists
        const exists = wires.some(w => w.fromPin === wiringFrom.pin && w.toComponentId === compId && w.toComponentPin === pinId)
        if (exists) {
            console.log('[WIRE] Wire already exists')
            return true
        }

        // Create new wire
        const newWire: Wire = {
            id: `wire-${Date.now()}`,
            fromPin: wiringFrom.pin,
            toComponentId: compId,
            toComponentPin: pinId,
            color: WIRE_COLORS[wires.length % WIRE_COLORS.length],
        }
        console.log('[WIRE] Created wire:', newWire)
        onWiresChange([...wires, newWire])
        setWiringFrom(null)
        setWiringMouse(null)
        return true
    }, [wiringMode, wiringFrom, wires, onWiresChange, getPinPosition, placedComponents])

    // ===== Track mouse during wiring for preview =====
    const handleWiringMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (wiringFrom) {
            const pos = screenToSVG(e.clientX, e.clientY)
            setWiringMouse(pos)
        }
    }, [wiringFrom, screenToSVG])

    // Override onPinClick to intercept wiring mode
    const handlePinClickWithWire = useCallback((gpio: number) => {
        if (handleWirePinClick(gpio)) return
        onPinClick?.(gpio)
    }, [handleWirePinClick, onPinClick])

    // ===== Orthogonal wire preview path (Köşeli) =====
    const wirePath = useCallback((x1: number, y1: number, x2: number, y2: number, midX?: number) => {
        const mx = midX !== undefined ? midX : x1 + (x2 - x1) / 2
        return `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`
    }, [])

    // Prevent default wheel on container
    useEffect(() => {
        const container = svgRef.current?.parentElement
        if (!container) return
        const prevent = (e: WheelEvent) => e.preventDefault()
        container.addEventListener('wheel', prevent, { passive: false })
        return () => container.removeEventListener('wheel', prevent)
    }, [])

    // Determine cursor based on mode
    const svgCursor = wiringFrom ? 'crosshair' : wiringMode ? 'crosshair' : deleteMode ? 'not-allowed' : placementMode ? 'crosshair' : draggingId ? 'grabbing' : 'grab'

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

                {/* Wire mode toggle */}
                <button
                    className={`board-add__btn board-add__btn--delete ${wiringMode ? 'board-add__btn--active-wire' : ''}`}
                    onClick={() => {
                        setWiringMode(!wiringMode)
                        setWiringFrom(null)
                        setWiringMouse(null)
                        setDeleteMode(false)
                        setPlacementMode(null)
                        setShowPalette(false)
                    }}
                    title={wiringMode ? 'Cancel wiring' : 'Draw wires'}
                >
                    🔗
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

            {/* Wiring mode indicator */}
            {wiringMode && (
                <div className="board-placement-hint board-placement-hint--wire">
                    🔗 {wiringFrom ? 'Click a component pin to connect' : 'Click an ESP board pin to start wiring'}
                    <button className="board-placement-hint__cancel" onClick={() => { setWiringMode(false); setWiringFrom(null); setWiringMouse(null) }}>Cancel (Esc)</button>
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
                preserveAspectRatio="xMidYMid meet"
                className="board-svg"
                xmlns="http://www.w3.org/2000/svg"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={(e) => { handleMouseMove(e); handleWiringMouseMove(e) }}
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
                            side="left" pinStates={pinStates} selectedPin={selectedPin} onPinClick={handlePinClickWithWire}
                            hoveredPin={hoveredPin} onHover={setHoveredPin} />
                    ))}
                    {RIGHT_PINS.map((pin, i) => (
                        <PinCircle key={`right-${i}`} pin={pin} x={RIGHT_PIN_X} y={PIN_START_Y + i * PIN_SPACING}
                            side="right" pinStates={pinStates} selectedPin={selectedPin} onPinClick={handlePinClickWithWire}
                            hoveredPin={hoveredPin} onHover={setHoveredPin} />
                    ))}

                    {/* Board label */}
                    <text x={BOARD_WIDTH / 2} y={BOARD_HEIGHT - 18} textAnchor="middle" fontSize={8} fontFamily="'Inter', sans-serif" fill="#4ecca355">
                        ESP32-S3-DevKitC-1
                    </text>
                </g>

                {/* Wires */}
                {wires.map(wire => {
                    const pinPos = getPinPosition(wire.fromPin)
                    const comp = placedComponents.find(c => c.id === wire.toComponentId)
                    if (!pinPos || !comp) return null

                    const offset = getComponentPinOffset(comp.type, wire.toComponentPin)
                    const endX = comp.x + offset.x
                    const endY = comp.y + offset.y

                    const mx = wire.midX !== undefined ? wire.midX : pinPos.x + (endX - pinPos.x) / 2
                    const path = wirePath(pinPos.x, pinPos.y, endX, endY, wire.midX)

                    const cx = mx
                    const cy = pinPos.y + (endY - pinPos.y) / 2
                    const vLen = Math.abs(endY - pinPos.y)

                    return (
                        <g key={wire.id}
                            style={{ cursor: deleteMode ? 'not-allowed' : 'default' }}
                        >
                            <g onClick={(ev: React.MouseEvent) => {
                                ev.stopPropagation()
                                if (deleteMode) { onWiresChange(wires.filter(w => w.id !== wire.id)) }
                            }}>
                                {/* Wire shadow */}
                                <path d={path} fill="none" stroke="#000" strokeWidth={4} opacity={0.3} strokeLinecap="round" strokeLinejoin="round" />
                                {/* Wire body */}
                                <path d={path} fill="none" stroke={wire.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                            </g>

                            {/* Wire endpoints */}
                            <circle cx={pinPos.x} cy={pinPos.y} r={4} fill={wire.color} stroke="#000" strokeWidth={1} />
                            <circle cx={endX} cy={endY} r={4} fill={wire.color} stroke="#000" strokeWidth={1} />

                            {/* Middle Vertical Drag Handle */}
                            {!deleteMode && vLen >= 2 && (
                                <circle cx={cx} cy={cy} r={5} fill={wire.color} stroke="#fff" strokeWidth={1.5}
                                    style={{ cursor: 'ew-resize' }}
                                    onPointerDown={(ev: React.PointerEvent<SVGCircleElement>) => {
                                        ev.stopPropagation()
                                        ev.currentTarget.setPointerCapture(ev.pointerId)
                                        const pos = screenToSVG(ev.clientX, ev.clientY)
                                        setDraggingSegment({ wireId: wire.id, offsetX: pos.x - mx })
                                    }}
                                    onPointerUp={(ev: React.PointerEvent<SVGCircleElement>) => {
                                        ev.currentTarget.releasePointerCapture(ev.pointerId)
                                        setDraggingSegment(null)
                                    }}
                                />
                            )}
                        </g>
                    )
                })}

                {/* Wire preview while drawing */}
                {wiringFrom && wiringMouse && (
                    <path
                        d={wirePath(wiringFrom.x, wiringFrom.y, wiringMouse.x, wiringMouse.y)}
                        fill="none" stroke="#4ecca3" strokeWidth={2} strokeDasharray="6 4" opacity={0.7} strokeLinecap="round" strokeLinejoin="round"
                    />
                )}

                {/* Placed Components (independent of board position) */}
                {placedComponents.map(comp => {
                    const commonProps = {
                        key: comp.id,
                        comp,
                        onDragStart: deleteMode ? () => { } : handleComponentDragStart,
                        onSelect: handleComponentSelect,
                        isDragging: draggingId === comp.id,
                        isSelected: selectedComponentId === comp.id,
                        wiringMode,
                        onPinClick: handleWireComponentPinClick
                    };

                    if (comp.type === 'led') return (
                        <PlacedLED
                            {...commonProps}
                            isOn={getLedOnFromWires(comp.id, wires, pinStates)}
                        />
                    )
                    if (comp.type === 'button') return (
                        <PlacedButton
                            {...commonProps}
                            onPress={deleteMode ? () => { } : (id, pressed) => {
                                // Debounce: allow state transitions, filter rapid same-state duplicates
                                const now = Date.now()
                                const prev = btnDebounce.current.get(id)
                                if (prev && pressed === prev.state && now - prev.time < BUTTON_DEBOUNCE_MS) return
                                btnDebounce.current.set(id, { state: pressed, time: now })

                                // Update visual state
                                onComponentsChange(placedComponents.map(c =>
                                    c.id === id ? { ...c, on: pressed } : c
                                ))

                                // Resolve circuit: which GPIOs are driven and to what state
                                // Pressed → drive GPIO to the circuit-determined state
                                // Released → GPIO returns to its default (INPUT_PULLUP → HIGH, INPUT → LOW)
                                if (onButtonPress) {
                                    const effects = getButtonCircuitEffects(id, wires)
                                    for (const { gpioPin, pressedState } of effects) {
                                        const releaseState = pinStates.get(gpioPin)?.mode === 'INPUT_PULLUP' ? 'HIGH' : 'LOW'
                                        onButtonPress(gpioPin, pressed ? pressedState : releaseState)
                                    }
                                }
                            }}
                        />
                    )
                    if (comp.type === 'oled') return (
                        <PlacedOLED
                            {...commonProps}
                            displayBuffer={isOledWiredCorrectly(comp.id, wires) ? displayBuffer : null}
                        />
                    )
                    if (comp.type === 'buzzer') return (
                        <PlacedBuzzer
                            {...commonProps}
                            buzzerState={getBuzzerStateFromWires(comp.id, wires, pinStates, activeTone)}
                        />
                    )
                    if (comp.type === 'potentiometer') return (
                        <PlacedPotentiometer
                            {...commonProps}
                            wiredGpio={getPotWiredGpio(comp.id, wires)}
                            onValueChange={(id, val) => {
                                onComponentsChange(placedComponents.map(c =>
                                    c.id === id ? { ...c, value: val } : c
                                ))
                                const gpio = getPotWiredGpio(id, wires)
                                if (gpio !== null) onAnalogChange?.(gpio, val)
                            }}
                        />
                    )
                    return null
                })}
            </svg>
        </div>
    )
}
