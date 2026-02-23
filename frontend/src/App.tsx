import { useState } from 'react'
import MonacoEditor, { DEFAULT_SKETCH } from './components/MonacoEditor'
import './components/MonacoEditor.css'
import './App.css'

/**
 * Main application layout for the ESP32-S3 Simulator.
 * Uses a 2-panel design: left = code editor, right = board visualization.
 */
function App() {
  const [code, setCode] = useState(DEFAULT_SKETCH)

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

        {/* Right Panel — Board Visualization (Step 3) */}
        <section className="panel">
          <div className="panel__header">🔌 Board</div>
          <div className="panel__content">
            <div className="placeholder">
              <div className="placeholder__icon">🔌</div>
              <p>ESP32-S3 Board will be here</p>
              <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                (Step 3 — Board.tsx)
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ===== Footer / Status Bar ===== */}
      <footer className="footer">
        <span>ESP32-S3 Web Simulator v0.1</span>
        <span>{code.split('\n').length} lines</span>
      </footer>
    </div>
  )
}

export default App
