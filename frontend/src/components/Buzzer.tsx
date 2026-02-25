import { memo } from 'react'

// ===== Buzzer Props =====

export interface BuzzerProps {
    /** Whether the buzzer is currently active (making sound) */
    on?: boolean
    /** Active frequency in Hz (shown in label area) */
    frequency?: number
    /** Buzzer housing color */
    color?: 'black' | 'green' | 'blue' | string
    /** Component size in pixels (diameter of the housing) */
    size?: number
    /** Optional label below the buzzer */
    label?: string
    /** Click handler */
    onClick?: () => void
}

// ===== Color Presets =====

const COLOR_MAP: Record<string, string> = {
    black: '#1a1a1a',
    green: '#1a3a2a',
    blue: '#1a2a3a',
}

function resolveColor(color: string): string {
    return COLOR_MAP[color] ?? color
}

// ===== Buzzer Component =====

/**
 * Realistic SVG piezo buzzer component.
 * Shows animated sound wave arcs when active.
 */
const Buzzer = memo(function Buzzer({
    on = false,
    frequency = 1000,
    color = 'black',
    size = 70,
    label,
    onClick,
}: BuzzerProps) {
    const resolvedColor = resolveColor(color)
    const r = size / 2
    const cx = r + 10
    const cy = r + 10
    const svgW = size + 20
    const svgH = size + 50

    return (
        <div
            className="buzzer-component"
            style={{
                display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, userSelect: 'none', cursor: onClick ? 'pointer' : 'default',
            }}
            onClick={onClick}
        >
            <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
                {/* Outer glow when active */}
                {on && (
                    <circle cx={cx} cy={cy} r={r + 8} fill="#f59e0b" opacity={0.15}>
                        <animate attributeName="opacity" values="0.15;0.05;0.15" dur="0.6s" repeatCount="indefinite" />
                    </circle>
                )}

                {/* Housing base */}
                <circle cx={cx} cy={cy} r={r} fill={resolvedColor} stroke="#444" strokeWidth={2.5} />

                {/* Inner ring */}
                <circle cx={cx} cy={cy} r={r * 0.75} fill="none" stroke="#333" strokeWidth={1.5} />

                {/* Center diaphragm */}
                <circle cx={cx} cy={cy} r={r * 0.35}
                    fill={on ? '#555' : '#2a2a2a'}
                    stroke={on ? '#888' : '#444'}
                    strokeWidth={1.5}
                />

                {/* Sound hole pattern */}
                <circle cx={cx} cy={cy} r={r * 0.12} fill="#111" />

                {/* "+" marking */}
                <text x={cx + r * 0.55} y={cy - r * 0.4} textAnchor="middle" fontSize={8}
                    fontWeight="bold" fill="#666" fontFamily="'Inter', sans-serif">+</text>

                {/* Sound wave arcs — only when active */}
                {on && [1, 2, 3].map(i => (
                    <path
                        key={i}
                        d={`M ${cx + r * 0.5 + i * 6} ${cy - 8} Q ${cx + r * 0.5 + i * 6 + 4} ${cy} ${cx + r * 0.5 + i * 6} ${cy + 8}`}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        opacity={0.7}
                    >
                        <animate attributeName="opacity" values="0.7;0.1;0.7"
                            dur={`${0.4 + i * 0.15}s`} repeatCount="indefinite" />
                    </path>
                ))}

                {/* Metal legs */}
                <rect x={cx - 6} y={cy + r + 2} width={4} height={14} fill="#999" rx={1} />
                <rect x={cx + 2} y={cy + r + 2} width={4} height={14} fill="#999" rx={1} />

                {/* Pin labels */}
                <text x={cx - 4} y={cy + r + 24} textAnchor="middle" fontSize={6}
                    fill="#888" fontFamily="'Inter', sans-serif">+</text>
                <text x={cx + 4} y={cy + r + 24} textAnchor="middle" fontSize={6}
                    fill="#888" fontFamily="'Inter', sans-serif">−</text>
            </svg>

            {label && (
                <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono, monospace)', color: '#888' }}>
                    {label}
                </span>
            )}

            <span style={{
                fontSize: '0.55rem', fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 600, letterSpacing: '0.05em', padding: '1px 6px', borderRadius: 4,
                color: on ? '#f59e0b' : '#888',
                background: on ? 'rgba(245, 158, 11, 0.15)' : 'rgba(128, 128, 128, 0.1)',
            }}>
                {on ? `${frequency} Hz` : 'SILENT'}
            </span>
        </div>
    )
})

export default Buzzer
