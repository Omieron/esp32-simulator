import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Buzzer from './Buzzer'
import { BuzzerAudio } from '../simulator/buzzer'

// ===== Buzzer Standalone Component Tests =====

describe('Buzzer', () => {
    it('renders in SILENT state by default', () => {
        render(<Buzzer />)
        expect(screen.getByText('SILENT')).toBeInTheDocument()
    })

    it('renders frequency when on=true', () => {
        render(<Buzzer on={true} frequency={440} />)
        expect(screen.getByText('440 Hz')).toBeInTheDocument()
    })

    it('shows default 1000 Hz when on but no frequency specified', () => {
        render(<Buzzer on={true} />)
        expect(screen.getByText('1000 Hz')).toBeInTheDocument()
    })

    it('shows label when provided', () => {
        render(<Buzzer label="BZR1" />)
        expect(screen.getByText('BZR1')).toBeInTheDocument()
    })

    it('does not show label when not provided', () => {
        render(<Buzzer />)
        expect(screen.queryByText('BZR1')).not.toBeInTheDocument()
    })

    it('calls onClick when clicked', async () => {
        const user = userEvent.setup()
        const handleClick = vi.fn()
        render(<Buzzer onClick={handleClick} />)
        await user.click(screen.getByText('SILENT').closest('.buzzer-component')!)
        expect(handleClick).toHaveBeenCalledOnce()
    })

    it('shows sound wave arcs only when active', () => {
        const { container, rerender } = render(<Buzzer on={false} />)
        const offPaths = container.querySelectorAll('path')
        expect(offPaths.length).toBe(0)

        rerender(<Buzzer on={true} />)
        const onPaths = container.querySelectorAll('path')
        expect(onPaths.length).toBe(3)
        const animates = container.querySelectorAll('path animate')
        expect(animates.length).toBe(3)
    })

    it('shows glow effect only when on', () => {
        const { container, rerender } = render(<Buzzer on={false} />)
        const offAnimates = container.querySelectorAll('circle animate')
        expect(offAnimates.length).toBe(0)

        rerender(<Buzzer on={true} />)
        const onAnimates = container.querySelectorAll('circle animate')
        expect(onAnimates.length).toBeGreaterThan(0)
    })

    it('accepts color prop (preset name)', () => {
        const { container } = render(<Buzzer color="green" on={true} />)
        const circles = container.querySelectorAll('circle')
        expect(circles.length).toBeGreaterThan(0)
    })

    it('accepts color prop (custom hex)', () => {
        const { container } = render(<Buzzer color="#ff00ff" on={true} />)
        const circles = container.querySelectorAll('circle')
        expect(circles.length).toBeGreaterThan(0)
    })

    it('renders metal legs', () => {
        const { container } = render(<Buzzer />)
        const rects = container.querySelectorAll('rect')
        expect(rects.length).toBeGreaterThanOrEqual(2)
    })

    it('applies custom size', () => {
        const { container } = render(<Buzzer size={100} />)
        const svg = container.querySelector('svg')
        expect(svg).toBeTruthy()
        expect(svg!.getAttribute('width')).toBe('120')
    })
})

// ===== BuzzerAudio (Web Audio API Wrapper) Tests =====

function createMockOscillator() {
    return {
        type: 'sine' as OscillatorType,
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
    }
}

function createMockGain() {
    return {
        gain: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
    }
}

describe('BuzzerAudio', () => {
    let latestOsc: ReturnType<typeof createMockOscillator>
    let latestGain: ReturnType<typeof createMockGain>
    let mockClose: ReturnType<typeof vi.fn>

    beforeEach(() => {
        latestOsc = createMockOscillator()
        latestGain = createMockGain()
        mockClose = vi.fn()

        class MockAudioContext {
            state = 'running'
            currentTime = 0
            destination = {}
            resume = vi.fn()
            close = mockClose
            createOscillator = vi.fn(() => {
                latestOsc = createMockOscillator()
                return latestOsc
            })
            createGain = vi.fn(() => {
                latestGain = createMockGain()
                return latestGain
            })
        }

        vi.stubGlobal('AudioContext', MockAudioContext)
    })

    it('isPlaying() returns false initially', () => {
        const buzzer = new BuzzerAudio()
        expect(buzzer.isPlaying()).toBe(false)
    })

    it('play() starts oscillator and sets isPlaying', () => {
        const buzzer = new BuzzerAudio()
        buzzer.play(440)
        expect(buzzer.isPlaying()).toBe(true)
        expect(latestOsc.start).toHaveBeenCalled()
        expect(latestOsc.type).toBe('square')
    })

    it('play() with same frequency is a no-op', () => {
        const buzzer = new BuzzerAudio()
        buzzer.play(440)
        const firstOsc = latestOsc
        buzzer.play(440)
        expect(latestOsc).toBe(firstOsc)
    })

    it('play() with different frequency updates without recreating', () => {
        const buzzer = new BuzzerAudio()
        buzzer.play(440)
        const firstOsc = latestOsc
        buzzer.play(880)
        expect(latestOsc).toBe(firstOsc)
        expect(firstOsc.frequency.setValueAtTime).toHaveBeenCalledWith(880, 0)
        expect(buzzer.getFrequency()).toBe(880)
    })

    it('stop() stops oscillator and resets frequency', () => {
        const buzzer = new BuzzerAudio()
        buzzer.play(440)
        expect(buzzer.isPlaying()).toBe(true)
        buzzer.stop()
        expect(buzzer.isPlaying()).toBe(false)
        expect(buzzer.getFrequency()).toBe(0)
    })

    it('play(0) calls stop', () => {
        const buzzer = new BuzzerAudio()
        buzzer.play(440)
        expect(buzzer.isPlaying()).toBe(true)
        buzzer.play(0)
        expect(buzzer.isPlaying()).toBe(false)
    })

    it('setVolume() clamps to 0-1 range', () => {
        const buzzer = new BuzzerAudio()
        buzzer.play(440)

        buzzer.setVolume(-0.5)
        expect(latestGain.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0)

        buzzer.setVolume(5)
        expect(latestGain.gain.setValueAtTime).toHaveBeenLastCalledWith(1, 0)

        buzzer.setVolume(0.5)
        expect(latestGain.gain.setValueAtTime).toHaveBeenLastCalledWith(0.5, 0)
    })

    it('getFrequency() returns current frequency', () => {
        const buzzer = new BuzzerAudio()
        expect(buzzer.getFrequency()).toBe(0)
        buzzer.play(262)
        expect(buzzer.getFrequency()).toBe(262)
    })

    it('dispose() closes AudioContext', () => {
        const buzzer = new BuzzerAudio()
        buzzer.play(440)
        buzzer.dispose()
        expect(buzzer.isPlaying()).toBe(false)
    })

    it('dispose() after stop does not throw', () => {
        const buzzer = new BuzzerAudio()
        buzzer.play(440)
        buzzer.stop()
        expect(() => buzzer.dispose()).not.toThrow()
    })
})
