import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Button from './Button'

describe('Button', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders in RELEASED state by default', () => {
        render(<Button />)
        expect(screen.getByText('RELEASED')).toBeInTheDocument()
    })

    it('renders in PRESSED state when pressed=true', () => {
        render(<Button pressed={true} />)
        expect(screen.getByText('PRESSED')).toBeInTheDocument()
    })

    it('shows label when provided', () => {
        render(<Button label="BTN1" />)
        expect(screen.getByText('BTN1')).toBeInTheDocument()
    })

    it('fires onPress(true) on mousedown', () => {
        const handlePress = vi.fn()
        const { container } = render(<Button onPress={handlePress} />)
        const pressArea = container.querySelector('rect[style*="cursor: pointer"]')!
        fireEvent.mouseDown(pressArea)
        expect(handlePress).toHaveBeenCalledWith(true)
    })

    it('fires onPress(false) on mouseup', () => {
        const handlePress = vi.fn()
        const { container } = render(<Button onPress={handlePress} />)
        const pressArea = container.querySelector('rect[style*="cursor: pointer"]')!
        fireEvent.mouseDown(pressArea)
        vi.advanceTimersByTime(50)
        fireEvent.mouseUp(pressArea)
        expect(handlePress).toHaveBeenCalledWith(false)
    })

    it('fires onPress(false) on mouseleave when pressed', () => {
        const handlePress = vi.fn()
        const { container } = render(<Button onPress={handlePress} />)
        const pressArea = container.querySelector('rect[style*="cursor: pointer"]')!
        fireEvent.mouseDown(pressArea)
        vi.advanceTimersByTime(50)
        fireEvent.mouseLeave(pressArea)
        expect(handlePress).toHaveBeenCalledWith(false)
    })

    it('debounces rapid same-state events within debounce window', () => {
        const handlePress = vi.fn()
        const { container } = render(<Button onPress={handlePress} debounceMs={50} />)
        const pressArea = container.querySelector('rect[style*="cursor: pointer"]')!

        // First press fires
        fireEvent.mouseDown(pressArea)
        expect(handlePress).toHaveBeenCalledTimes(1)
        expect(handlePress).toHaveBeenLastCalledWith(true)

        // Rapid second press within debounce window is filtered
        fireEvent.mouseDown(pressArea)
        expect(handlePress).toHaveBeenCalledTimes(1)

        // After debounce window, same-state event is allowed
        vi.advanceTimersByTime(60)
        fireEvent.mouseDown(pressArea)
        expect(handlePress).toHaveBeenCalledTimes(2)
    })

    it('allows state transitions even within debounce window', () => {
        const handlePress = vi.fn()
        const { container } = render(<Button onPress={handlePress} debounceMs={50} />)
        const pressArea = container.querySelector('rect[style*="cursor: pointer"]')!

        // Press fires
        fireEvent.mouseDown(pressArea)
        expect(handlePress).toHaveBeenCalledTimes(1)
        expect(handlePress).toHaveBeenLastCalledWith(true)

        // Release (opposite direction) fires immediately even within debounce window
        fireEvent.mouseUp(pressArea)
        expect(handlePress).toHaveBeenCalledTimes(2)
        expect(handlePress).toHaveBeenLastCalledWith(false)
    })

    it('accepts color prop (preset name)', () => {
        const { container } = render(<Button color="red" />)
        const cap = container.querySelectorAll('rect')[2] // cap rect
        expect(cap).toBeTruthy()
    })

    it('accepts color prop (custom hex)', () => {
        const { container } = render(<Button color="#ff00ff" />)
        const cap = container.querySelectorAll('rect')[2]
        expect(cap).toBeTruthy()
    })

    it('calls onClick when clicked', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        const handleClick = vi.fn()
        render(<Button onClick={handleClick} />)
        await user.click(screen.getByText('RELEASED').closest('.button-component')!)
        expect(handleClick).toHaveBeenCalledOnce()
    })

    it('renders 4 metal pins', () => {
        const { container } = render(<Button />)
        // Housing + cavity + cap + highlight + 4 pins + press area = multiple rects
        const rects = container.querySelectorAll('rect')
        expect(rects.length).toBeGreaterThanOrEqual(7)
    })
})
