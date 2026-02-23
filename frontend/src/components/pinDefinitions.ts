// ===== ESP32-S3 DevKit Pin Definitions =====
// Each pin has a number, label, and physical position on the board.

/** Represents the state of a single GPIO pin. */
export interface PinState {
    number: number
    mode: 'INPUT' | 'OUTPUT'
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
    { gpio: 4, label: 'GPIO4' },
    { gpio: 5, label: 'GPIO5' },
    { gpio: 6, label: 'GPIO6' },
    { gpio: 7, label: 'GPIO7' },
    { gpio: 15, label: 'GPIO15' },
    { gpio: 16, label: 'GPIO16' },
    { gpio: 17, label: 'GPIO17' },
    { gpio: 18, label: 'GPIO18' },
    { gpio: 8, label: 'GPIO8' },
    { gpio: 3, label: 'GPIO3' },
    { gpio: 46, label: 'GPIO46' },
    { gpio: 9, label: 'GPIO9' },
    { gpio: 10, label: 'GPIO10' },
    { gpio: 11, label: 'GPIO11' },
    { gpio: 12, label: 'GPIO12' },
    { gpio: 13, label: 'GPIO13' },
    { gpio: 14, label: 'GPIO14' },
    { gpio: -4, label: '5V', isPower: true },
    { gpio: -5, label: 'GND', isPower: true },
]

// Right side pins (top to bottom) — ESP32-S3 DevKit-C
export const RIGHT_PINS: PinDefinition[] = [
    { gpio: -6, label: 'GND', isPower: true },
    { gpio: 43, label: 'TX' },
    { gpio: 44, label: 'RX' },
    { gpio: 1, label: 'GPIO1' },
    { gpio: 2, label: 'GPIO2' },
    { gpio: 42, label: 'GPIO42' },
    { gpio: 41, label: 'GPIO41' },
    { gpio: 40, label: 'GPIO40' },
    { gpio: 39, label: 'GPIO39' },
    { gpio: 38, label: 'GPIO38' },
    { gpio: 37, label: 'GPIO37' },
    { gpio: 36, label: 'GPIO36' },
    { gpio: 35, label: 'GPIO35' },
    { gpio: 0, label: 'GPIO0' },
    { gpio: 45, label: 'GPIO45' },
    { gpio: 48, label: 'RGB' },
    { gpio: 47, label: 'GPIO47' },
    { gpio: 21, label: 'GPIO21' },
    { gpio: 20, label: 'GPIO20' },
    { gpio: 19, label: 'GPIO19' },
    { gpio: -7, label: 'GND', isPower: true },
    { gpio: -8, label: '5V', isPower: true },
]
