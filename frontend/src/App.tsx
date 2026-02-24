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

  // Pin states: use WebSocket only when backend is running, else sim (avoids stale pin state after Stop Sim)
  const displayPinStates = ws.isRunning ? ws.pinStates : sim.simPinStates

  // Serial output: same logic as pin states
  const displaySerialOutput = ws.isRunning ? ws.serialOutput : sim.simSerialOutput
  const clearSerial = ws.isRunning ? ws.clearSerial : sim.clearSimSerial

  // Placed components on the board
  const [placedComponents, setPlacedComponents] = useState<PlacedComponent[]>([])

  // Wires connecting pins to components
  const [wires, setWires] = useState<Wire[]>([])

  const handlePinClick = useCallback((gpio: number) => {
    setSelectedPin((prev) => (prev === gpio ? null : gpio))
    console.log(`Pin clicked: GPIO${gpio}`, displayPinStates.get(gpio))
  }, [displayPinStates])

  const handleUpload = useCallback(() => {
    ws.uploadCode(code)
  }, [ws, code])

  const handleStop = useCallback(() => {
    ws.stopExecution()
  }, [ws])

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
              {ws.isCompiling ? (
                <span className="compile-spinner" title="Compiling...">
                  <span className="compile-spinner__ring" />
                  <span className="compile-spinner__text">Compiling...</span>
                </span>
              ) : !ws.isRunning ? (
                <button
                  className="editor-toolbar__btn editor-toolbar__btn--primary"
                  onClick={handleUpload}
                  disabled={ws.status !== 'connected'}
                  style={{ opacity: ws.status !== 'connected' ? 0.5 : 1 }}
                >
                  ▶ Upload &amp; Run
                </button>
              ) : (
                <button
                  className="editor-toolbar__btn"
                  onClick={handleStop}
                  style={{ background: '#e94560', color: 'white', border: '1px solid #e94560' }}
                >
                  ⏹ Stop
                </button>
              )}
              {!sim.isSimRunning ? (
                <button
                  className="editor-toolbar__btn"
                  onClick={sim.startSimulation}
                  title="Run JS simulation (blinks GPIO 2)"
                >
                  ⚡ Simulate
                </button>
              ) : (
                <button
                  className="editor-toolbar__btn"
                  onClick={sim.stopSimulation}
                  style={{ background: '#e94560', color: 'white', border: '1px solid #e94560' }}
                  title="Stop JS simulation"
                >
                  ⏹ Stop Sim
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

          {/* Error display */}
          {ws.lastError && (
            <div className="compile-error">
              <span>❌ {ws.lastError}</span>
            </div>
          )}
          {/* Success display (brief) */}
          {ws.lastSuccess && !ws.lastError && (
            <div className="compile-success">
              <span>✓ {ws.lastSuccess}</span>
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
