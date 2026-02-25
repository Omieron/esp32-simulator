import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OLED from './OLED'
import { OLEDDisplay, OLED_WIDTH, OLED_HEIGHT, SSD1306_SWITCHCAPVCC, SSD1306_I2C_ADDRESS, OLED_WHITE } from '../simulator/oled'

// Mock canvas context — jsdom doesn't support canvas natively
function mockCanvasContext() {
    const imageData = { data: new Uint8ClampedArray(OLED_WIDTH * OLED_HEIGHT * 4) }
    const ctx = {
        fillStyle: '',
        fillRect: vi.fn(),
        createImageData: vi.fn(() => imageData),
        putImageData: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 204, 255, 255]) })),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    return ctx
}

// ===== Standalone OLED Component Tests =====

describe('OLED Component', () => {
    beforeEach(() => {
        mockCanvasContext()
    })

    it('renders with POWER ON by default', () => {
        render(<OLED />)
        expect(screen.getByText('POWER ON')).toBeInTheDocument()
    })

    it('renders with POWER OFF when on=false', () => {
        render(<OLED on={false} />)
        expect(screen.getByText('POWER OFF')).toBeInTheDocument()
    })

    it('renders pin labels (GND, VCC, SCL, SDA)', () => {
        render(<OLED />)
        expect(screen.getByText('GND')).toBeInTheDocument()
        expect(screen.getByText('VCC')).toBeInTheDocument()
        expect(screen.getByText('SCL')).toBeInTheDocument()
        expect(screen.getByText('SDA')).toBeInTheDocument()
    })

    it('renders a canvas element with correct dimensions', () => {
        render(<OLED />)
        const canvas = screen.getByTestId('oled-canvas') as HTMLCanvasElement
        expect(canvas.width).toBe(128)
        expect(canvas.height).toBe(64)
    })

    it('shows label when provided', () => {
        render(<OLED label="SSD1306" />)
        expect(screen.getByText('SSD1306')).toBeInTheDocument()
    })

    it('accepts a pixel buffer', () => {
        const buf = new Uint8Array(OLED_WIDTH * OLED_HEIGHT)
        buf[0] = 1
        const { container } = render(<OLED buffer={buf} />)
        expect(container.querySelector('canvas')).toBeTruthy()
    })
})

// ===== OLEDDisplay Simulation Tests =====

describe('OLEDDisplay (simulation)', () => {
    it('initializes with begin() and correct I2C address', () => {
        const oled = new OLEDDisplay()
        oled.begin(SSD1306_SWITCHCAPVCC, SSD1306_I2C_ADDRESS)
        expect(oled.isInitialized()).toBe(true)
        expect(oled.getI2CAddress()).toBe(0x3C)
    })

    it('clearDisplay() zeroes the buffer', () => {
        const oled = new OLEDDisplay()
        oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)
        oled.drawPixel(10, 20, 1)
        oled.clearDisplay()
        expect(oled.getPixel(10, 20)).toBe(0)
    })

    it('drawPixel() sets and gets pixels correctly', () => {
        const oled = new OLEDDisplay()
        oled.drawPixel(0, 0, 1)
        expect(oled.getPixel(0, 0)).toBe(1)
        oled.drawPixel(0, 0, 0)
        expect(oled.getPixel(0, 0)).toBe(0)
    })

    it('drawPixel() ignores out-of-bounds', () => {
        const oled = new OLEDDisplay()
        oled.drawPixel(-1, 0, 1)
        oled.drawPixel(0, -1, 1)
        oled.drawPixel(128, 0, 1)
        oled.drawPixel(0, 64, 1)
        // Should not throw
        expect(oled.getPixel(-1, 0)).toBe(0)
    })

    it('drawString() renders text at given position', () => {
        const oled = new OLEDDisplay()
        oled.drawString(0, 0, 'A')
        // 'A' (ASCII 65) first column in font5x7 is 0x7E → bits: 0111 1110
        // That means rows 1-6 are lit in column 0
        expect(oled.getPixel(0, 1)).toBe(1)
        expect(oled.getPixel(0, 2)).toBe(1)
    })

    it('drawString() does not affect global cursor', () => {
        const oled = new OLEDDisplay()
        oled.setCursor(50, 50)
        oled.drawString(0, 0, 'X')
        // After drawString, cursor should be restored to (50, 50)
        // Verify by printing at cursor position
        oled.print('.')
        // '.' is at font index (46-32)*5 = 70. First column 0x00 → no pixel at col 0
        // But the cursor advanced by 6 from 50, so cursorX should now be 56
        // Pixel at (50, 50+1) from '.' — column 0 of '.' is 0x00 (empty)
        // Column 2 of '.' (at x=52) is 0x60 → bits 5,6 set → rows 5,6 lit
        expect(oled.getPixel(52, 55)).toBe(1) // row 5 at cursor y=50
    })

    it('setCursor() + println() renders text with line wrapping', () => {
        const oled = new OLEDDisplay()
        oled.setCursor(0, 0)
        oled.println('Hi')
        // After println, cursorY should advance by 8 (default textSize=1)
        oled.print('2')
        // '2' starts at y=8. Column 0 of '2' is 0x42 → bits 1,6 → rows 1,6
        expect(oled.getPixel(0, 9)).toBe(1) // row 1 at y=8
    })

    it('setTextSize() scales text', () => {
        const oled = new OLEDDisplay()
        oled.setTextSize(2)
        oled.setCursor(0, 0)
        oled.print('I')
        // 'I' column 1 is 0x41 (bits 0 and 6). At size 2: pixels at (2,0),(2,1),(3,0),(3,1) for bit 0
        expect(oled.getPixel(2, 0)).toBe(1)
        expect(oled.getPixel(3, 1)).toBe(1)
    })

    it('display() calls onDisplayUpdate callback', () => {
        const cb = vi.fn()
        const oled = new OLEDDisplay({ onDisplayUpdate: cb })
        oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)
        oled.drawPixel(5, 5, 1)
        oled.display()
        expect(cb).toHaveBeenCalledOnce()
        const buf = cb.mock.calls[0][0] as Uint8Array
        expect(buf[5 * 128 + 5]).toBe(1)
    })

    it('display() sends a copy of the buffer (immutable)', () => {
        const cb = vi.fn()
        const oled = new OLEDDisplay({ onDisplayUpdate: cb })
        oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)
        oled.drawPixel(0, 0, 1)
        oled.display()
        // Modify internal buffer
        oled.clearDisplay()
        oled.display()
        // First call should still have pixel set
        const buf1 = cb.mock.calls[0][0] as Uint8Array
        expect(buf1[0]).toBe(1)
        // Second call should be cleared
        const buf2 = cb.mock.calls[1][0] as Uint8Array
        expect(buf2[0]).toBe(0)
    })

    it('drawLine() renders a horizontal line', () => {
        const oled = new OLEDDisplay()
        oled.drawLine(0, 0, 10, 0, 1)
        for (let x = 0; x <= 10; x++) {
            expect(oled.getPixel(x, 0)).toBe(1)
        }
        expect(oled.getPixel(11, 0)).toBe(0)
    })

    it('drawRect() renders rectangle outline', () => {
        const oled = new OLEDDisplay()
        oled.drawRect(0, 0, 5, 5, 1)
        // Top edge
        expect(oled.getPixel(2, 0)).toBe(1)
        // Left edge
        expect(oled.getPixel(0, 2)).toBe(1)
        // Interior should be empty
        expect(oled.getPixel(2, 2)).toBe(0)
    })

    it('fillRect() fills rectangle area', () => {
        const oled = new OLEDDisplay()
        oled.fillRect(0, 0, 5, 5, 1)
        expect(oled.getPixel(2, 2)).toBe(1)
        expect(oled.getPixel(4, 4)).toBe(1)
        expect(oled.getPixel(5, 5)).toBe(0)
    })

    it('drawCircle() renders circle outline', () => {
        const oled = new OLEDDisplay()
        oled.drawCircle(32, 32, 10, 1)
        // Top of circle
        expect(oled.getPixel(32, 22)).toBe(1)
        // Center should be empty
        expect(oled.getPixel(32, 32)).toBe(0)
    })

    it('fillCircle() fills circular area', () => {
        const oled = new OLEDDisplay()
        oled.fillCircle(32, 32, 5, 1)
        expect(oled.getPixel(32, 32)).toBe(1)
        expect(oled.getPixel(33, 33)).toBe(1)
    })

    it('getBuffer() returns correct-sized buffer', () => {
        const oled = new OLEDDisplay()
        const buf = oled.getBuffer()
        expect(buf.length).toBe(OLED_WIDTH * OLED_HEIGHT)
    })

    it('setTextColor() affects text rendering', () => {
        const oled = new OLEDDisplay()
        oled.setTextColor(OLED_WHITE, 0)
        oled.setCursor(0, 0)
        oled.print('A')
        // With bg=0: background pixels should be explicitly set to 0
        // First column of 'A' is 0x7E, row 0 is bit 0 → 0 (bg)
        expect(oled.getPixel(0, 0)).toBe(0)
        // Row 1 is bit 1 → 1 (fg)
        expect(oled.getPixel(0, 1)).toBe(1)
    })
})
