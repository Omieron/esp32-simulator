import { memo, useRef, useEffect } from 'react'
import { OLED_WIDTH, OLED_HEIGHT } from '../simulator/oled'

// ===== Props =====

export interface OLEDProps {
    /** 128×64 pixel buffer (each byte 0=off, 1=on). Null = powered off. */
    buffer?: Uint8Array | null
    /** Pixel scale: each OLED pixel = N×N screen pixels (default 2) */
    pixelSize?: number
    /** Lit pixel color (default '#00ccff') */
    color?: string
    /** Background color (default '#050505') */
    bgColor?: string
    /** Optional label below the display */
    label?: string
    /** Power state — when off shows blank screen */
    on?: boolean
}

/** Renders a 128×64 monochrome OLED pixel buffer onto a <canvas>. */
export function renderOLEDBuffer(
    canvas: HTMLCanvasElement,
    buffer: Uint8Array | null,
    color: string,
    bgColor: string,
) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear with background
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, OLED_WIDTH, OLED_HEIGHT)

    if (!buffer || buffer.length < OLED_WIDTH * OLED_HEIGHT) return

    // Parse lit pixel color to RGB
    const tmp = document.createElement('canvas')
    tmp.width = 1; tmp.height = 1
    const tmpCtx = tmp.getContext('2d')!
    tmpCtx.fillStyle = color
    tmpCtx.fillRect(0, 0, 1, 1)
    const [r, g, b] = tmpCtx.getImageData(0, 0, 1, 1).data

    const imgData = ctx.createImageData(OLED_WIDTH, OLED_HEIGHT)
    for (let i = 0; i < OLED_WIDTH * OLED_HEIGHT; i++) {
        const idx = i * 4
        if (buffer[i]) {
            imgData.data[idx] = r
            imgData.data[idx + 1] = g
            imgData.data[idx + 2] = b
            imgData.data[idx + 3] = 255
        }
        // else stays transparent (background already drawn)
    }
    ctx.putImageData(imgData, 0, 0)
}

// ===== OLED Component =====

const OLED = memo(function OLED({
    buffer = null,
    pixelSize = 2,
    color = '#00ccff',
    bgColor = '#050505',
    label,
    on = true,
}: OLEDProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        if (!on) {
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.fillStyle = bgColor
                ctx.fillRect(0, 0, OLED_WIDTH, OLED_HEIGHT)
            }
            return
        }

        renderOLEDBuffer(canvas, buffer, color, bgColor)
    }, [buffer, color, bgColor, on])

    const totalW = OLED_WIDTH * pixelSize + 20

    return (
        <div style={{
            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
            gap: 4, userSelect: 'none',
        }}>
            {/* PCB frame */}
            <div style={{
                background: '#0a3d6b',
                borderRadius: 6,
                padding: '8px 10px 16px',
                border: '2px solid #0d4f8a',
                width: totalW,
                boxSizing: 'border-box',
            }}>
                {/* Screen bezel */}
                <div style={{
                    background: '#111',
                    borderRadius: 3,
                    padding: 3,
                    border: '1px solid #333',
                }}>
                    <canvas
                        ref={canvasRef}
                        width={OLED_WIDTH}
                        height={OLED_HEIGHT}
                        data-testid="oled-canvas"
                        style={{
                            display: 'block',
                            width: OLED_WIDTH * pixelSize,
                            height: OLED_HEIGHT * pixelSize,
                            imageRendering: 'pixelated',
                            borderRadius: 2,
                        }}
                    />
                </div>

                {/* Pin labels */}
                <div style={{
                    display: 'flex', justifyContent: 'center', gap: 12, marginTop: 6,
                    fontSize: '0.5rem', fontFamily: "'JetBrains Mono', monospace", color: '#1a6fb0',
                }}>
                    <span>GND</span><span>VCC</span><span>SCL</span><span>SDA</span>
                </div>
            </div>

            {label && (
                <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono, monospace)', color: '#888' }}>
                    {label}
                </span>
            )}

            <span style={{
                fontSize: '0.55rem', fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 600, letterSpacing: '0.05em', padding: '1px 6px', borderRadius: 4,
                color: on ? 'var(--accent-success, #4ecca3)' : '#888',
                background: on ? 'rgba(78,204,163,0.15)' : 'rgba(128,128,128,0.1)',
            }}>
                {on ? 'POWER ON' : 'POWER OFF'}
            </span>
        </div>
    )
})

export default OLED
