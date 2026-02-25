// ===== ESP32-S3 DevKit Pin Definitions =====
// Each pin has a number, label, and physical position on the board.

/** Represents the state of a single GPIO pin. */
export interface PinState {
    number: number
    mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP'
    state: 'LOW' | 'HIGH'
}

/** Describes a pin's physical location and label on the board. */
export interface PinDefinition {
    /** GPIO number */
    gpio: number
    /** Display label (e.g. "GPIO2", "3V3", "GND") */
    label: string
    /** Whether this is a power/ground pin (not interactive) */
    isPower?: boolean
}

// Left side pins (top to bottom) — ESP32-S3 DevKit-C
export const LEFT_PINS: PinDefinition[] = [
    { gpio: -1, label: '3V3', isPower: true },
    { gpio: -2, label: '3V3', isPower: true },
    { gpio: -3, label: 'RST', isPower: true },
    { gpio: 4, label: '4' },
    { gpio: 5, label: '5' },
    { gpio: 6, label: '6' },
    { gpio: 7, label: '7' },
    { gpio: 15, label: '15' },
    { gpio: 16, label: '16' },
    { gpio: 17, label: '17' },
    { gpio: 18, label: '18' },
    { gpio: 8, label: '8' },
    { gpio: 3, label: '3' },
    { gpio: 46, label: '46' },
    { gpio: 9, label: '9' },
    { gpio: 10, label: '10' },
    { gpio: 11, label: '11' },
    { gpio: 12, label: '12' },
    { gpio: 13, label: '13' },
    { gpio: 14, label: '14' },
    { gpio: -4, label: '5V', isPower: true },
    { gpio: -5, label: 'GND', isPower: true },
]

// Right side pins (top to bottom) — ESP32-S3 DevKit-C
export const RIGHT_PINS: PinDefinition[] = [
    { gpio: -6, label: 'GND', isPower: true },
    { gpio: 43, label: 'TX' },
    { gpio: 44, label: 'RX' },
    { gpio: 1, label: '1' },
    { gpio: 2, label: '2' },
    { gpio: 42, label: '42' },
    { gpio: 41, label: '41' },
    { gpio: 40, label: '40' },
    { gpio: 39, label: '39' },
    { gpio: 38, label: '38' },
    { gpio: 37, label: '37' },
    { gpio: 36, label: '36' },
    { gpio: 35, label: '35' },
    { gpio: 0, label: '0' },
    { gpio: 45, label: '45' },
    { gpio: 48, label: 'RGB' },
    { gpio: 47, label: '47' },
    { gpio: 21, label: '21' },
    { gpio: 20, label: '20' },
    { gpio: 19, label: '19' },
    { gpio: -7, label: 'GND', isPower: true },
    { gpio: -8, label: '5V', isPower: true },
]
