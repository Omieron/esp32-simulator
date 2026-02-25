import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Potentiometer from './Potentiometer'

describe('Potentiometer', () => {
    it('renders with default value 0', () => {
        render(<Potentiometer />)
        expect(screen.getByText('0 / 4095 (0%)')).toBeInTheDocument()
    })

    it('displays provided value and percentage', () => {
        render(<Potentiometer value={2048} />)
        expect(screen.getByText('2048 / 4095 (50%)')).toBeInTheDocument()
    })

    it('displays max value correctly', () => {
        render(<Potentiometer value={4095} />)
        expect(screen.getByText('4095 / 4095 (100%)')).toBeInTheDocument()
    })

    it('shows label when provided', () => {
        render(<Potentiometer label="POT1" />)
        expect(screen.getByText('POT1')).toBeInTheDocument()
    })

    it('does not show label when not provided', () => {
        render(<Potentiometer />)
        expect(screen.queryByText('POT1')).not.toBeInTheDocument()
    })

    it('calls onClick when clicked', async () => {
        const user = userEvent.setup()
        const handleClick = vi.fn()
        render(<Potentiometer onClick={handleClick} />)
        await user.click(screen.getByText('0 / 4095 (0%)').closest('.potentiometer-component')!)
        expect(handleClick).toHaveBeenCalledOnce()
    })

    it('renders 3 metal legs', () => {
        const { container } = render(<Potentiometer />)
        const rects = container.querySelectorAll('rect')
        expect(rects.length).toBeGreaterThanOrEqual(3)
    })

    it('renders pin labels VCC, SIG, GND', () => {
        render(<Potentiometer />)
        expect(screen.getByText('VCC')).toBeInTheDocument()
        expect(screen.getByText('SIG')).toBeInTheDocument()
        expect(screen.getByText('GND')).toBeInTheDocument()
    })

    it('renders track arc and knob', () => {
        const { container } = render(<Potentiometer />)
        const paths = container.querySelectorAll('path')
        expect(paths.length).toBeGreaterThanOrEqual(1)
        const circles = container.querySelectorAll('circle')
        expect(circles.length).toBeGreaterThanOrEqual(3)
    })

    it('renders active arc when value > 0', () => {
        const { container: c0 } = render(<Potentiometer value={0} />)
        const paths0 = c0.querySelectorAll('path')

        const { container: c1 } = render(<Potentiometer value={2048} />)
        const paths1 = c1.querySelectorAll('path')

        expect(paths1.length).toBeGreaterThan(paths0.length)
    })

    it('accepts color prop (preset name)', () => {
        const { container } = render(<Potentiometer color="green" />)
        const circles = container.querySelectorAll('circle')
        expect(circles.length).toBeGreaterThan(0)
    })

    it('accepts color prop (custom hex)', () => {
        const { container } = render(<Potentiometer color="#ff00ff" />)
        const circles = container.querySelectorAll('circle')
        expect(circles.length).toBeGreaterThan(0)
    })

    it('applies custom size', () => {
        const { container } = render(<Potentiometer size={100} />)
        const svg = container.querySelector('svg')
        expect(svg).toBeTruthy()
        expect(svg!.getAttribute('width')).toBe('120')
    })
})
