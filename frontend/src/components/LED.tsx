import { memo } from 'react'
import './LED.css'

// ===== LED Props =====

export interface LEDProps {
    /** LED color — supports any CSS color or preset names */
    color?: 'red' | 'green' | 'blue' | 'yellow' | 'white' | string
    /** Whether the LED is currently on */
    on?: boolean
    /** Brightness level 0-255 (for PWM simulation) */
    brightness?: number
    /** LED size in pixels */
    size?: number
    /** Optional label displayed below the LED */
    label?: string
    /** Whether to show a blink animation */
    blinking?: boolean
    /** Blink speed in ms (default 1000) */
    blinkSpeed?: number
    /** Click handler */
    onClick?: () => void
}

// ===== Color Presets =====
const COLOR_MAP: Record<string, string> = {
    red: '#ff3333',
    green: '#33ff33',
    blue: '#3388ff',
    yellow: '#ffdd33',
    white: '#ffffff',
}

function resolveColor(color: string): string {
    return COLOR_MAP[color] ?? color
}

// ===== LED Component =====

/**
 * Realistic SVG LED component with glow effect.
 * Supports on/off state, brightness (PWM), blinking, and multiple colors.
 */
const LED = memo(function LED({
    color = 'red',
    on = false,
    brightness = 255,
    size = 40,
    label,
    blinking = false,
    blinkSpeed = 1000,
    onClick,
}: LEDProps) {
    const resolvedColor = resolveColor(color)
    const opacity = on ? brightness / 255 : 0
    const glowSize = size * 0.6

    return (
        <div
            className={`led-component ${onClick ? 'led-component--interactive' : ''}`}
            onClick={onClick}
            style={{ width: size + 20 }}
        >
            <svg
                width={size + 20}
                height={size + 20}
                viewBox={`0 0 ${size + 20} ${size + 20}`}
                className="led-svg"
            >
                <defs>
                    {/* Radial gradient for the glass dome */}
                    <radialGradient id={`led-grad-${color}`} cx="40%" cy="35%" r="50%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.6} />
                        <stop offset="50%" stopColor={resolvedColor} stopOpacity={on ? 0.8 : 0.15} />
                        <stop offset="100%" stopColor={resolvedColor} stopOpacity={on ? 0.6 : 0.08} />
                    </radialGradient>

                    {/* Glow filter */}
                    <filter id={`led-glow-${color}`} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation={glowSize * 0.15} result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Outer glow when ON */}
                {on && (
                    <circle
                        cx={(size + 20) / 2}
                        cy={(size + 20) / 2}
                        r={size * 0.55}
                        fill={resolvedColor}
                        opacity={opacity * 0.3}
                        filter={`url(#led-glow-${color})`}
                    >
                        {blinking && (
                            <animate
                                attributeName="opacity"
                                values={`${opacity * 0.3};0.05;${opacity * 0.3}`}
                                dur={`${blinkSpeed}ms`}
                                repeatCount="indefinite"
                            />
                        )}
                    </circle>
                )}

                {/* LED base (dark ring) */}
                <circle
                    cx={(size + 20) / 2}
                    cy={(size + 20) / 2}
                    r={size * 0.42}
                    fill="#222"
                    stroke="#444"
                    strokeWidth={1.5}
                />

                {/* LED dome (colored glass) */}
                <circle
                    cx={(size + 20) / 2}
                    cy={(size + 20) / 2}
                    r={size * 0.35}
                    fill={`url(#led-grad-${color})`}
                    stroke={on ? resolvedColor : '#555'}
                    strokeWidth={on ? 1 : 0.5}
                    opacity={on ? opacity : 0.25}
                >
                    {blinking && on && (
                        <animate
                            attributeName="opacity"
                            values={`${opacity};0.08;${opacity}`}
                            dur={`${blinkSpeed}ms`}
                            repeatCount="indefinite"
                        />
                    )}
                </circle>

                {/* Highlight reflection */}
                <ellipse
                    cx={(size + 20) / 2 - size * 0.08}
                    cy={(size + 20) / 2 - size * 0.1}
                    rx={size * 0.12}
                    ry={size * 0.08}
                    fill="white"
                    opacity={0.35}
                />

                {/* LED legs (two metal pins) */}
                <rect
                    x={(size + 20) / 2 - size * 0.12}
                    y={(size + 20) / 2 + size * 0.38}
                    width={size * 0.06}
                    height={size * 0.22}
                    fill="#999"
                    rx={1}
                />
                <rect
                    x={(size + 20) / 2 + size * 0.06}
                    y={(size + 20) / 2 + size * 0.38}
                    width={size * 0.06}
                    height={size * 0.30}
                    fill="#999"
                    rx={1}
                />
            </svg>

            {/* Label */}
            {label && <span className="led-label">{label}</span>}

            {/* State indicator */}
            <span className={`led-state ${on ? 'led-state--on' : 'led-state--off'}`}>
                {on ? 'ON' : 'OFF'}
            </span>
        </div>
    )
})

export default LED
