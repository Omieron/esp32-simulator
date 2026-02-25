import { memo, useRef, useCallback } from 'react'

// ===== Button Props =====

export interface ButtonProps {
    /** Button cap color */
    color?: 'grey' | 'red' | 'blue' | 'green' | string
    /** Whether the button is currently pressed */
    pressed?: boolean
    /** Button size in pixels (width of the housing) */
    size?: number
    /** Optional label displayed below the button */
    label?: string
    /** Debounce window in ms — filters rapid duplicate events (default 30ms) */
    debounceMs?: number
    /** Fired on press / release. `pressed` = true on mousedown, false on mouseup */
    onPress?: (pressed: boolean) => void
    /** Click handler (for non-tactile use) */
    onClick?: () => void
}

// ===== Color Presets =====

const COLOR_MAP: Record<string, string> = {
    grey: '#555',
    red: '#cc3333',
    blue: '#3366cc',
    green: '#33aa55',
}

function resolveColor(color: string): string {
    return COLOR_MAP[color] ?? color
}

// ===== Button Component =====

/**
 * Realistic SVG tactile push-button with debounce.
 *
 * Electrical model (when used in Board):
 * - 4 pins: TL/BL (side A, always connected), TR/BR (side B, always connected)
 * - Pressing bridges A ↔ B
 *
 * Debounce:
 * - Filters rapid duplicate state changes within `debounceMs` window.
 * - State *transitions* (press→release, release→press) are always allowed;
 *   only same-direction duplicates within the window are filtered.
 */
const Button = memo(function Button({
    color = 'grey',
    pressed = false,
    size = 90,
    label,
    debounceMs = 30,
    onPress,
    onClick,
}: ButtonProps) {
    const resolvedColor = resolveColor(color)
    const h = size * 0.78
    const lastState = useRef(pressed)
    const lastTime = useRef(0)

    const firePress = useCallback((newPressed: boolean) => {
        const now = Date.now()
        // Allow state transitions; filter rapid same-state duplicates
        if (newPressed === lastState.current && now - lastTime.current < debounceMs) return
        lastState.current = newPressed
        lastTime.current = now
        onPress?.(newPressed)
    }, [onPress, debounceMs])

    return (
        <div
            className="button-component"
            style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, userSelect: 'none' }}
            onClick={onClick}
        >
            <svg
                width={size + 20}
                height={h + 20}
                viewBox={`0 0 ${size + 20} ${h + 20}`}
            >
                {/* Housing */}
                <rect x={10} y={10} width={size} height={h} rx={6}
                    fill="#1a1a1a" stroke="#444" strokeWidth={2.5} />

                {/* Inner cavity */}
                <rect x={18} y={18} width={size - 16} height={h - 16} rx={4}
                    fill="#111" />

                {/* Cap (plunger) — shifts down when pressed */}
                <rect
                    x={24} y={pressed ? 28 : 23}
                    width={size - 28} height={h - 28} rx={4}
                    fill={resolvedColor}
                    stroke={pressed ? '#fff3' : '#0003'}
                    strokeWidth={2}
                    opacity={pressed ? 1 : 0.85}
                />

                {/* Highlight on cap */}
                {!pressed && (
                    <rect x={28} y={25} width={size - 36} height={6} rx={3}
                        fill="white" opacity={0.2} />
                )}

                {/* 4 metal pins */}
                <rect x={2} y={h / 2 - 2} width={10} height={7} fill="#999" rx={1.5} />
                <rect x={2} y={h / 2 + 16} width={10} height={7} fill="#999" rx={1.5} />
                <rect x={size + 8} y={h / 2 - 2} width={10} height={7} fill="#999" rx={1.5} />
                <rect x={size + 8} y={h / 2 + 16} width={10} height={7} fill="#999" rx={1.5} />

                {/* Invisible press area */}
                <rect x={18} y={18} width={size - 16} height={h - 16} fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseDown={(e) => { e.stopPropagation(); firePress(true) }}
                    onMouseUp={() => firePress(false)}
                    onMouseLeave={() => { if (lastState.current) firePress(false) }}
                />
            </svg>

            {label && (
                <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono, monospace)', color: '#888' }}>
                    {label}
                </span>
            )}

            <span style={{
                fontSize: '0.55rem',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 600,
                letterSpacing: '0.05em',
                padding: '1px 6px',
                borderRadius: 4,
                color: pressed ? 'var(--accent-success, #4ecca3)' : '#888',
                background: pressed ? 'rgba(78, 204, 163, 0.15)' : 'rgba(128, 128, 128, 0.1)',
            }}>
                {pressed ? 'PRESSED' : 'RELEASED'}
            </span>
        </div>
    )
})

export default Button
