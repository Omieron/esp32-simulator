import { useState, useCallback } from 'react'
import MonacoEditor, { DEFAULT_SKETCH } from './components/MonacoEditor'
import Board from './components/Board'
import type { PlacedComponent, Wire } from './components/Board'
import useWebSocket from './hooks/useWebSocket'
import useSimulation from './hooks/useSimulation'
import './components/MonacoEditor.css'
import './components/Board.css'
import './App.css'

/**
 * Main application layout for the ESP32-S3 Simulator.
 * Left = code editor, Right = board with placeable components.
 */
function App() {
  const [code, setCode] = useState(DEFAULT_SKETCH)
  const [selectedPin, setSelectedPin] = useState<number | null>(null)

  // WebSocket connection to Go backend
  const ws = useWebSocket()

  // JS simulation (frontend-only, no backend)
  const sim = useSimulation()

  // Pin states and serial: from JS simulation (onPinChange, onSerial callbacks)
  const displayPinStates = sim.simPinStates
  const displaySerialOutput = sim.simSerialOutput
  const clearSerial = sim.clearSimSerial

  // Placed components on the board
  const [placedComponents, setPlacedComponents] = useState<PlacedComponent[]>([])

  // Wires connecting pins to components
  const [wires, setWires] = useState<Wire[]>([])

  const handlePinClick = useCallback((gpio: number) => {
    setSelectedPin((prev) => (prev === gpio ? null : gpio))
    console.log(`Pin clicked: GPIO${gpio}`, displayPinStates.get(gpio))
  }, [displayPinStates])

  // Upload & Run: transpile → runtime → run (JS simulation)
  const handleUpload = useCallback(() => {
    sim.startSimulation(code)
  }, [sim, code])

  const handleStop = useCallback(() => {
    sim.stopSimulation()
  }, [sim])

  // Button press → drive wired GPIO pin in the JS runtime
  const handleButtonPress = useCallback((gpio: number, state: 'HIGH' | 'LOW') => {
    sim.setPinState(gpio, state)
  }, [sim])

  // Status dot color
  const statusColor =
    ws.status === 'connected' ? 'var(--accent-success)' :
      ws.status === 'connecting' ? 'var(--accent-warning, #f0c040)' :
        'var(--text-muted)'

  const statusLabel =
    ws.status === 'connected' ? 'Connected' :
      ws.status === 'connecting' ? 'Connecting…' :
        ws.status === 'error' ? 'Error' : 'Disconnected'

  return (
    <div className="app">
      {/* ===== Header ===== */}
      <header className="header">
        <h1 className="header__title">⚡ ESP32-S3 Simulator</h1>
        <div className="header__status">
          <span className="header__status-dot" style={{ background: statusColor }}></span>
          <span>{statusLabel}</span>
        </div>
      </header>

      {/* ===== Main 2-Panel Layout ===== */}
      <main className="main">
        {/* Left Panel — Code Editor */}
        <section className="panel">
          <div className="panel__header">
            <span>📝 Code Editor</span>
            <div className="editor-toolbar" style={{ display: 'inline-flex', marginLeft: '12px', padding: 0, background: 'transparent', border: 'none', gap: '6px', alignItems: 'center' }}>
              {!sim.isSimRunning ? (
                <button
                  className="editor-toolbar__btn editor-toolbar__btn--primary"
                  onClick={handleUpload}
                  title="Transpile Arduino code and run in browser"
                >
                  ▶ Upload &amp; Run
                </button>
              ) : (
                <button
                  className="editor-toolbar__btn"
                  onClick={handleStop}
                  style={{ background: '#e94560', color: 'white', border: '1px solid #e94560' }}
                  title="Stop simulation"
                >
                  ⏹ Stop
                </button>
              )}
            </div>
          </div>
          <div className="panel__content" style={{ padding: 0 }}>
            <MonacoEditor code={code} onChange={setCode} />
          </div>

          {/* Serial Output */}
          {displaySerialOutput.length > 0 && (
            <div className="serial-monitor">
              <div className="serial-monitor__header">
                <span>📟 Serial Monitor</span>
                <button className="serial-monitor__clear" onClick={clearSerial}>Clear</button>
              </div>
              <div className="serial-monitor__output">
                {displaySerialOutput.map((line, i) => (
                  <div key={i} className="serial-monitor__line">{line}</div>
                ))}
              </div>
            </div>
          )}

          {/* Error display (transpile or runtime) */}
          {sim.lastError && (
            <div className="compile-error">
              <span>❌ {sim.lastError}</span>
            </div>
          )}
        </section>

        {/* Right Panel — Board */}
        <section className="panel">
          <div className="panel__header">
            🔌 Board
            {selectedPin !== null && (
              <span style={{ marginLeft: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-success)' }}>
                · GPIO{selectedPin} selected
              </span>
            )}
            {placedComponents.length > 0 && (
              <span style={{ marginLeft: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                · {placedComponents.length} component{placedComponents.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="panel__content" style={{ padding: 0 }}>
            <Board
              pinStates={displayPinStates}
              onPinClick={handlePinClick}
              selectedPin={selectedPin}
              placedComponents={placedComponents}
              onComponentsChange={setPlacedComponents}
              wires={wires}
              onWiresChange={setWires}
              onButtonPress={handleButtonPress}
              displayBuffer={sim.displayBuffer}
            />
          </div>
        </section>
      </main>

      {/* ===== Footer ===== */}
      <footer className="footer">
        <span>ESP32-S3 Web Simulator v0.1</span>
        <span>{code.split('\n').length} lines</span>
      </footer>
    </div>
  )
}

export default App
