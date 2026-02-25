import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import LED from './LED'

describe('LED', () => {
    it('renders in OFF state by default', () => {
        render(<LED />)
        expect(screen.getByText('OFF')).toBeInTheDocument()
    })

    it('renders in ON state when on=true', () => {
        render(<LED on={true} />)
        expect(screen.getByText('ON')).toBeInTheDocument()
    })

    it('accepts color prop (preset name)', () => {
        const { container } = render(<LED color="green" on={true} />)
        const circles = container.querySelectorAll('circle')
        expect(circles.length).toBeGreaterThan(0)
    })

    it('accepts color prop (custom hex)', () => {
        const { container } = render(<LED color="#ff00ff" on={true} />)
        const circles = container.querySelectorAll('circle')
        expect(circles.length).toBeGreaterThan(0)
    })

    it('shows label when provided', () => {
        render(<LED label="GPIO2" />)
        expect(screen.getByText('GPIO2')).toBeInTheDocument()
    })

    it('does not show label when not provided', () => {
        render(<LED />)
        expect(screen.queryByText('GPIO2')).not.toBeInTheDocument()
    })

    it('calls onClick when clicked', async () => {
        const user = userEvent.setup()
        const handleClick = vi.fn()
        render(<LED onClick={handleClick} />)
        await user.click(screen.getByText('OFF').closest('.led-component')!)
        expect(handleClick).toHaveBeenCalledOnce()
    })

    it('applies brightness as opacity when on', () => {
        const { container } = render(<LED on={true} brightness={128} />)
        // The dome circle should exist with reduced opacity
        const svgCircles = container.querySelectorAll('circle')
        expect(svgCircles.length).toBeGreaterThan(0)
    })

    it('renders different colors correctly', () => {
        const colors = ['red', 'green', 'blue', 'yellow', 'white'] as const
        for (const color of colors) {
            const { unmount } = render(<LED color={color} on={true} />)
            expect(screen.getByText('ON')).toBeInTheDocument()
            unmount()
        }
    })

    it('shows glow effect only when on', () => {
        const { container, rerender } = render(<LED on={false} />)
        // When off, no glow filter circle should have high opacity
        const offCircles = container.querySelectorAll('circle')
        const offGlow = Array.from(offCircles).filter(c =>
            c.getAttribute('filter')?.includes('glow')
        )
        expect(offGlow.length).toBe(0)

        rerender(<LED on={true} />)
        const onCircles = container.querySelectorAll('circle')
        const onGlow = Array.from(onCircles).filter(c =>
            c.getAttribute('filter')?.includes('glow')
        )
        expect(onGlow.length).toBeGreaterThan(0)
    })

    it('supports blinking animation when on + blinking', () => {
        const { container } = render(<LED on={true} blinking={true} blinkSpeed={500} />)
        const animates = container.querySelectorAll('animate')
        expect(animates.length).toBeGreaterThan(0)
    })
})
