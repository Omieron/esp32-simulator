import { useState, useCallback } from 'react'
import MonacoEditor, { DEFAULT_SKETCH } from './components/MonacoEditor'
import Board from './components/Board'
import type { PlacedComponent } from './components/Board'
import type { PinState } from './components/pinDefinitions'
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

  // Pin states (all INPUT / LOW by default)
  const [pinStates] = useState<Map<number, PinState>>(() => {
    const map = new Map<number, PinState>()
    for (let i = 0; i < 49; i++) {
      map.set(i, { number: i, mode: 'INPUT', state: 'LOW' })
    }
    return map
  })

  // Placed components on the board
  const [placedComponents, setPlacedComponents] = useState<PlacedComponent[]>([])

  const handlePinClick = useCallback((gpio: number) => {
    setSelectedPin((prev) => (prev === gpio ? null : gpio))
    console.log(`Pin clicked: GPIO${gpio}`, pinStates.get(gpio))
  }, [pinStates])

  return (
    <div className="app">
      {/* ===== Header ===== */}
      <header className="header">
        <h1 className="header__title">⚡ ESP32-S3 Simulator</h1>
        <div className="header__status">
          <span className="header__status-dot"></span>
          <span>Disconnected</span>
        </div>
      </header>

      {/* ===== Main 2-Panel Layout ===== */}
      <main className="main">
        {/* Left Panel — Code Editor */}
        <section className="panel">
          <div className="panel__header">
            <span>📝 Code Editor</span>
            <div className="editor-toolbar" style={{ display: 'inline-flex', marginLeft: '12px', padding: 0, background: 'transparent', border: 'none' }}>
              <button className="editor-toolbar__btn editor-toolbar__btn--primary">
                ▶ Upload & Run
              </button>
            </div>
          </div>
          <div className="panel__content" style={{ padding: 0 }}>
            <MonacoEditor code={code} onChange={setCode} />
          </div>
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
              pinStates={pinStates}
              onPinClick={handlePinClick}
              selectedPin={selectedPin}
              placedComponents={placedComponents}
              onComponentsChange={setPlacedComponents}
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
