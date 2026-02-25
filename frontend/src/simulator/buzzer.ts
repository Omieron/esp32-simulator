/**
 * Buzzer Audio — Web Audio API wrapper for piezo buzzer simulation.
 * Uses a square wave OscillatorNode to mimic a real piezo buzzer sound.
 * AudioContext is lazily created (browsers require a user gesture first).
 */

export class BuzzerAudio {
    private ctx: AudioContext | null = null
    private oscillator: OscillatorNode | null = null
    private gain: GainNode | null = null
    private currentFreq = 0
    private volume = 0.15

    private ensureContext(): AudioContext {
        if (!this.ctx) {
            this.ctx = new AudioContext()
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume()
        }
        return this.ctx
    }

    /** Start playing at the given frequency (Hz). If already playing, changes frequency. */
    play(frequency: number): void {
        if (frequency <= 0) {
            this.stop()
            return
        }

        const ctx = this.ensureContext()

        if (this.oscillator && this.currentFreq === frequency) return

        if (this.oscillator) {
            // Just update frequency without recreating the node
            this.oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)
            this.currentFreq = frequency
            return
        }

        // Create audio graph: OscillatorNode → GainNode → destination
        this.gain = ctx.createGain()
        this.gain.gain.setValueAtTime(this.volume, ctx.currentTime)
        this.gain.connect(ctx.destination)

        this.oscillator = ctx.createOscillator()
        this.oscillator.type = 'square'
        this.oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)
        this.oscillator.connect(this.gain)
        this.oscillator.start()

        this.currentFreq = frequency
    }

    /** Stop all sound output. */
    stop(): void {
        if (this.oscillator) {
            this.oscillator.stop()
            this.oscillator.disconnect()
            this.oscillator = null
        }
        if (this.gain) {
            this.gain.disconnect()
            this.gain = null
        }
        this.currentFreq = 0
    }

    /** Set output volume (0.0 – 1.0). */
    setVolume(v: number): void {
        this.volume = Math.max(0, Math.min(1, v))
        if (this.gain && this.ctx) {
            this.gain.gain.setValueAtTime(this.volume, this.ctx.currentTime)
        }
    }

    /** Returns true if the buzzer is currently producing sound. */
    isPlaying(): boolean {
        return this.oscillator !== null
    }

    /** Returns the current frequency in Hz, or 0 if silent. */
    getFrequency(): number {
        return this.currentFreq
    }

    /** Tear down the AudioContext entirely. */
    dispose(): void {
        this.stop()
        if (this.ctx) {
            this.ctx.close()
            this.ctx = null
        }
    }
}
