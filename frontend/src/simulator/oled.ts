/**
 * SSD1306 OLED Display Simulation (128x64 monochrome).
 * Provides Adafruit_SSD1306-compatible API for the JS runtime.
 * Maintains a 128×64 pixel buffer; display() flushes the buffer to the host.
 */

import { FONT_5X7 } from './font5x7'

export const OLED_WIDTH = 128
export const OLED_HEIGHT = 64
export const SSD1306_SWITCHCAPVCC = 0x02
export const SSD1306_I2C_ADDRESS = 0x3C
export const OLED_WHITE = 1
export const OLED_BLACK = 0

export interface OLEDCallbacks {
    onDisplayUpdate?: (buffer: Uint8Array) => void
}

export class OLEDDisplay {
    readonly width = OLED_WIDTH
    readonly height = OLED_HEIGHT
    private buffer: Uint8Array
    private cursorX = 0
    private cursorY = 0
    private textSize = 1
    private textColorFg = OLED_WHITE
    private textColorBg = -1 // -1 = transparent background
    private i2cAddr = 0
    private initialized = false
    private callbacks: OLEDCallbacks

    constructor(callbacks: OLEDCallbacks = {}) {
        this.buffer = new Uint8Array(OLED_WIDTH * OLED_HEIGHT)
        this.callbacks = callbacks
    }

    // ---- Lifecycle ----

    begin(_vccState: number, addr: number): void {
        this.i2cAddr = addr
        this.initialized = true
        this.buffer.fill(0)
    }

    // Flush internal buffer to the host (triggers React re-render)
    display(): void {
        if (!this.initialized) return
        this.callbacks.onDisplayUpdate?.(new Uint8Array(this.buffer))
    }

    clearDisplay(): void {
        this.buffer.fill(0)
    }

    // ---- Pixel-level ----

    drawPixel(x: number, y: number, color: number): void {
        x = Math.round(x)
        y = Math.round(y)
        if (x < 0 || x >= OLED_WIDTH || y < 0 || y >= OLED_HEIGHT) return
        this.buffer[y * OLED_WIDTH + x] = color ? 1 : 0
    }

    getPixel(x: number, y: number): number {
        if (x < 0 || x >= OLED_WIDTH || y < 0 || y >= OLED_HEIGHT) return 0
        return this.buffer[y * OLED_WIDTH + x]
    }

    // ---- Text ----

    setCursor(x: number, y: number): void {
        this.cursorX = x
        this.cursorY = y
    }

    setTextSize(size: number): void {
        this.textSize = Math.max(1, Math.floor(size))
    }

    setTextColor(fg: number, bg?: number): void {
        this.textColorFg = fg
        this.textColorBg = bg ?? -1
    }

    print(text: string | number): void {
        const str = String(text)
        for (const ch of str) {
            if (ch === '\n') {
                this.cursorX = 0
                this.cursorY += 8 * this.textSize
                continue
            }
            this.drawChar(this.cursorX, this.cursorY, ch, this.textColorFg, this.textColorBg, this.textSize)
            this.cursorX += 6 * this.textSize
        }
    }

    println(text: string | number): void {
        this.print(text)
        this.cursorX = 0
        this.cursorY += 8 * this.textSize
    }

    /** Convenience: draw text at (x, y) without affecting the global cursor. */
    drawString(x: number, y: number, text: string): void {
        const sx = this.cursorX
        const sy = this.cursorY
        this.cursorX = x
        this.cursorY = y
        this.print(text)
        this.cursorX = sx
        this.cursorY = sy
    }

    // ---- Primitives ----

    drawLine(x0: number, y0: number, x1: number, y1: number, color: number): void {
        x0 = Math.round(x0); y0 = Math.round(y0)
        x1 = Math.round(x1); y1 = Math.round(y1)
        const dx = Math.abs(x1 - x0)
        const dy = -Math.abs(y1 - y0)
        const sx = x0 < x1 ? 1 : -1
        const sy = y0 < y1 ? 1 : -1
        let err = dx + dy
        for (;;) {
            this.drawPixel(x0, y0, color)
            if (x0 === x1 && y0 === y1) break
            const e2 = 2 * err
            if (e2 >= dy) { err += dy; x0 += sx }
            if (e2 <= dx) { err += dx; y0 += sy }
        }
    }

    drawRect(x: number, y: number, w: number, h: number, color: number): void {
        this.drawLine(x, y, x + w - 1, y, color)
        this.drawLine(x + w - 1, y, x + w - 1, y + h - 1, color)
        this.drawLine(x + w - 1, y + h - 1, x, y + h - 1, color)
        this.drawLine(x, y + h - 1, x, y, color)
    }

    fillRect(x: number, y: number, w: number, h: number, color: number): void {
        for (let j = y; j < y + h; j++) {
            for (let i = x; i < x + w; i++) {
                this.drawPixel(i, j, color)
            }
        }
    }

    drawCircle(cx: number, cy: number, r: number, color: number): void {
        let x = r, y = 0, err = 1 - x
        while (x >= y) {
            this.drawPixel(cx + x, cy + y, color)
            this.drawPixel(cx + y, cy + x, color)
            this.drawPixel(cx - y, cy + x, color)
            this.drawPixel(cx - x, cy + y, color)
            this.drawPixel(cx - x, cy - y, color)
            this.drawPixel(cx - y, cy - x, color)
            this.drawPixel(cx + y, cy - x, color)
            this.drawPixel(cx + x, cy - y, color)
            y++
            if (err < 0) { err += 2 * y + 1 }
            else { x--; err += 2 * (y - x + 1) }
        }
    }

    fillCircle(cx: number, cy: number, r: number, color: number): void {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy <= r * r) {
                    this.drawPixel(cx + dx, cy + dy, color)
                }
            }
        }
    }

    // ---- Accessors ----

    getBuffer(): Uint8Array {
        return new Uint8Array(this.buffer)
    }

    isInitialized(): boolean {
        return this.initialized
    }

    getI2CAddress(): number {
        return this.i2cAddr
    }

    // ---- Private: character rendering ----

    private drawChar(x: number, y: number, ch: string, fg: number, bg: number, size: number): void {
        const code = ch.charCodeAt(0)
        if (code < 32 || code > 126) return
        const base = (code - 32) * 5
        for (let col = 0; col < 5; col++) {
            const bits = FONT_5X7[base + col]
            for (let row = 0; row < 7; row++) {
                const lit = (bits >> row) & 1
                if (lit) {
                    if (size === 1) this.drawPixel(x + col, y + row, fg)
                    else this.fillRect(x + col * size, y + row * size, size, size, fg)
                } else if (bg >= 0) {
                    if (size === 1) this.drawPixel(x + col, y + row, bg)
                    else this.fillRect(x + col * size, y + row * size, size, size, bg)
                }
            }
        }
        // 1-pixel gap between characters
        if (bg >= 0) {
            if (size === 1) {
                for (let row = 0; row < 7; row++) this.drawPixel(x + 5, y + row, bg)
            } else {
                this.fillRect(x + 5 * size, y, size, 7 * size, bg)
            }
        }
    }
}
