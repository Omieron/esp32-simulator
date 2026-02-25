import { memo, useCallback, useRef } from 'react'

// ===== Potentiometer Props =====

export interface PotentiometerProps {
    /** Current value (0-4095, 12-bit ADC) */
    value?: number
    /** Called when the user drags the knob */
    onChange?: (value: number) => void
    /** Housing color */
    color?: 'blue' | 'green' | 'black' | string
    /** Component size in pixels */
    size?: number
    /** Optional label below */
    label?: string
    /** Click handler */
    onClick?: () => void
}

const MAX_VALUE = 4095

const COLOR_MAP: Record<string, string> = {
    blue: '#1a3d6b',
    green: '#1a4a2a',
    black: '#222',
}

function resolveColor(color: string): string {
    return COLOR_MAP[color] ?? color
}

// Map value (0-4095) to knob rotation angle (−135° to +135°, 270° sweep)
function valueToAngle(value: number): number {
    return -135 + (value / MAX_VALUE) * 270
}

// Map angle (−135 to +135) back to value (0-4095)
function angleToValue(angle: number): number {
    const clamped = Math.max(-135, Math.min(135, angle))
    return Math.round(((clamped + 135) / 270) * MAX_VALUE)
}

// ===== Potentiometer Component =====

const Potentiometer = memo(function Potentiometer({
    value = 0,
    onChange,
    color = 'blue',
    size = 70,
    label,
    onClick,
}: PotentiometerProps) {
    const resolvedColor = resolveColor(color)
    const r = size / 2
    const cx = r + 10
    const cy = r + 10
    const svgW = size + 20
    const svgH = size + 60
    const angle = valueToAngle(value)
    const dragging = useRef(false)
    const svgRef = useRef<SVGSVGElement>(null)

    const handlePointerEvent = useCallback((clientX: number, clientY: number) => {
        const svg = svgRef.current
        if (!svg) return
        const rect = svg.getBoundingClientRect()
        const sx = clientX - rect.left
        const sy = clientY - rect.top
        const scaleX = svgW / rect.width
        const scaleY = svgH / rect.height
        const dx = sx * scaleX - cx
        const dy = sy * scaleY - cy
        const rad = Math.atan2(dx, -dy)
        const deg = rad * (180 / Math.PI)
        onChange?.(angleToValue(deg))
    }, [cx, cy, svgW, svgH, onChange])

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.stopPropagation()
        dragging.current = true
        ;(e.target as Element).setPointerCapture(e.pointerId)
        handlePointerEvent(e.clientX, e.clientY)
    }, [handlePointerEvent])

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging.current) return
        handlePointerEvent(e.clientX, e.clientY)
    }, [handlePointerEvent])

    const onPointerUp = useCallback(() => {
        dragging.current = false
    }, [])

    const knobR = r * 0.38
    const percent = Math.round((value / MAX_VALUE) * 100)

    return (
        <div
            className="potentiometer-component"
            style={{
                display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, userSelect: 'none', cursor: onClick ? 'pointer' : 'default',
            }}
            onClick={onClick}
        >
            <svg
                ref={svgRef}
                width={svgW} height={svgH}
                viewBox={`0 0 ${svgW} ${svgH}`}
            >
                {/* Outer housing */}
                <circle cx={cx} cy={cy} r={r} fill={resolvedColor} stroke="#555" strokeWidth={2.5} />

                {/* Track arc (270 degree sweep, from −135° to +135°) */}
                {(() => {
                    const trackR = r * 0.72
                    const startA = -135 * (Math.PI / 180) - Math.PI / 2
                    const endA = 135 * (Math.PI / 180) - Math.PI / 2
                    const x1 = cx + trackR * Math.cos(startA)
                    const y1 = cy + trackR * Math.sin(startA)
                    const x2 = cx + trackR * Math.cos(endA)
                    const y2 = cy + trackR * Math.sin(endA)
                    return (
                        <path
                            d={`M ${x1} ${y1} A ${trackR} ${trackR} 0 1 1 ${x2} ${y2}`}
                            fill="none" stroke="#444" strokeWidth={3} strokeLinecap="round"
                        />
                    )
                })()}

                {/* Active arc (filled portion) */}
                {value > 0 && (() => {
                    const trackR = r * 0.72
                    const startA = -135 * (Math.PI / 180) - Math.PI / 2
                    const curA = angle * (Math.PI / 180) - Math.PI / 2
                    const x1 = cx + trackR * Math.cos(startA)
                    const y1 = cy + trackR * Math.sin(startA)
                    const x2 = cx + trackR * Math.cos(curA)
                    const y2 = cy + trackR * Math.sin(curA)
                    const sweep = angle + 135
                    const largeArc = sweep > 180 ? 1 : 0
                    return (
                        <path
                            d={`M ${x1} ${y1} A ${trackR} ${trackR} 0 ${largeArc} 1 ${x2} ${y2}`}
                            fill="none" stroke="#4ecca3" strokeWidth={3} strokeLinecap="round"
                        />
                    )
                })()}

                {/* Tick marks at 0%, 50%, 100% */}
                {[-135, 0, 135].map((deg, i) => {
                    const rad = deg * (Math.PI / 180) - Math.PI / 2
                    const inner = r * 0.82
                    const outer = r * 0.95
                    return (
                        <line key={i}
                            x1={cx + inner * Math.cos(rad)} y1={cy + inner * Math.sin(rad)}
                            x2={cx + outer * Math.cos(rad)} y2={cy + outer * Math.sin(rad)}
                            stroke="#666" strokeWidth={1.5}
                        />
                    )
                })}

                {/* Knob (interactive area) */}
                <circle cx={cx} cy={cy} r={knobR} fill="#333" stroke="#666" strokeWidth={1.5}
                    style={{ cursor: onChange ? 'grab' : 'default' }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                />

                {/* Knob indicator line (rotates with value) */}
                <line
                    x1={cx} y1={cy}
                    x2={cx + (knobR - 4) * Math.sin(angle * Math.PI / 180)}
                    y2={cy - (knobR - 4) * Math.cos(angle * Math.PI / 180)}
                    stroke="#4ecca3" strokeWidth={2.5} strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                />

                {/* Center dot */}
                <circle cx={cx} cy={cy} r={3} fill="#4ecca3" style={{ pointerEvents: 'none' }} />

                {/* 3 metal legs */}
                <rect x={cx - 16} y={cy + r + 2} width={4} height={14} fill="#999" rx={1} />
                <rect x={cx - 2} y={cy + r + 2} width={4} height={14} fill="#999" rx={1} />
                <rect x={cx + 12} y={cy + r + 2} width={4} height={14} fill="#999" rx={1} />

                {/* Pin labels */}
                <text x={cx - 14} y={cy + r + 24} textAnchor="middle" fontSize={5}
                    fill="#888" fontFamily="'Inter', sans-serif">VCC</text>
                <text x={cx} y={cy + r + 24} textAnchor="middle" fontSize={5}
                    fill="#888" fontFamily="'Inter', sans-serif">SIG</text>
                <text x={cx + 14} y={cy + r + 24} textAnchor="middle" fontSize={5}
                    fill="#888" fontFamily="'Inter', sans-serif">GND</text>
            </svg>

            {label && (
                <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono, monospace)', color: '#888' }}>
                    {label}
                </span>
            )}

            <span style={{
                fontSize: '0.55rem', fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 600, letterSpacing: '0.05em', padding: '1px 6px', borderRadius: 4,
                color: '#4ecca3',
                background: 'rgba(78, 204, 163, 0.12)',
            }}>
                {value} / {MAX_VALUE} ({percent}%)
            </span>
        </div>
    )
})

export default Potentiometer
