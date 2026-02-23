import { useCallback } from 'react'
import Editor from '@monaco-editor/react'
import type { EditorProps } from '@monaco-editor/react'

// Extract the OnMount handler type from the Editor component props.
type OnMount = NonNullable<EditorProps['onMount']>

// ===== Props Interface =====

export interface MonacoEditorProps {
    /** Current code content */
    code: string
    /** Callback fired when code changes */
    onChange: (value: string) => void
    /** Editor language — defaults to "cpp" (Arduino is C++ based) */
    language?: string
}

// ===== Default Arduino Blink Sketch =====

export const DEFAULT_SKETCH = `// ESP32-S3 Blink Example
// Built-in LED is usually on GPIO 2

#define LED_PIN 2

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("ESP32-S3 Simulator Ready!");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  delay(1000);
}
`

// ===== Component =====

/**
 * MonacoEditor wraps the Monaco Editor with Arduino/C++ syntax highlighting
 * and a dark theme matching the simulator's color scheme.
 */
export default function MonacoEditor({
    code,
    onChange,
    language = 'cpp',
}: MonacoEditorProps) {
    // Configure editor on mount: custom theme, Arduino snippets, etc.
    const handleMount: OnMount = useCallback((editor, monaco) => {
        // Define a custom dark theme matching our app
        monaco.editor.defineTheme('esp32-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'e94560' },
                { token: 'string', foreground: '4ecca3' },
                { token: 'number', foreground: 'f5a623' },
                { token: 'type', foreground: '3b82f6' },
                { token: 'function', foreground: 'c084fc' },
                { token: 'preprocessor', foreground: 'e94560', fontStyle: 'bold' },
            ],
            colors: {
                'editor.background': '#0f0f1a',
                'editor.foreground': '#e0e0e0',
                'editor.lineHighlightBackground': '#1a1a2e',
                'editor.selectionBackground': '#533483',
                'editorCursor.foreground': '#e94560',
                'editorLineNumber.foreground': '#666680',
                'editorLineNumber.activeForeground': '#e94560',
                'editor.selectionHighlightBackground': '#53348333',
                'editorIndentGuide.background': '#1e2a4a',
                'editorIndentGuide.activeBackground': '#0f3460',
            },
        })

        // Apply our custom theme
        monaco.editor.setTheme('esp32-dark')

        // Register Arduino-specific autocomplete suggestions
        monaco.languages.registerCompletionItemProvider('cpp', {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            provideCompletionItems: (model: any, position: any) => {
                const word = model.getWordUntilPosition(position)
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                }

                const suggestions = [
                    // Pin modes
                    { label: 'pinMode', kind: monaco.languages.CompletionItemKind.Function, insertText: 'pinMode(${1:pin}, ${2:mode});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'Set pin mode (INPUT/OUTPUT)', range },
                    { label: 'digitalWrite', kind: monaco.languages.CompletionItemKind.Function, insertText: 'digitalWrite(${1:pin}, ${2:value});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'Write HIGH/LOW to pin', range },
                    { label: 'digitalRead', kind: monaco.languages.CompletionItemKind.Function, insertText: 'digitalRead(${1:pin})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'Read digital pin value', range },
                    { label: 'analogRead', kind: monaco.languages.CompletionItemKind.Function, insertText: 'analogRead(${1:pin})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'Read analog pin value (0-4095)', range },
                    { label: 'analogWrite', kind: monaco.languages.CompletionItemKind.Function, insertText: 'analogWrite(${1:pin}, ${2:value});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'Write PWM value to pin', range },
                    // Serial
                    { label: 'Serial.begin', kind: monaco.languages.CompletionItemKind.Function, insertText: 'Serial.begin(${1:115200});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'Initialize serial communication', range },
                    { label: 'Serial.println', kind: monaco.languages.CompletionItemKind.Function, insertText: 'Serial.println(${1:""});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'Print line to serial monitor', range },
                    // Timing
                    { label: 'delay', kind: monaco.languages.CompletionItemKind.Function, insertText: 'delay(${1:1000});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'Pause execution (milliseconds)', range },
                    { label: 'millis', kind: monaco.languages.CompletionItemKind.Function, insertText: 'millis()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'Milliseconds since boot', range },
                    // Constants
                    { label: 'HIGH', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'HIGH', detail: 'Logic high (3.3V)', range },
                    { label: 'LOW', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'LOW', detail: 'Logic low (0V)', range },
                    { label: 'INPUT', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'INPUT', detail: 'Pin input mode', range },
                    { label: 'OUTPUT', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'OUTPUT', detail: 'Pin output mode', range },
                    { label: 'INPUT_PULLUP', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'INPUT_PULLUP', detail: 'Pin input with pull-up', range },
                ]

                return { suggestions }
            },
        })

        // Focus the editor on mount
        editor.focus()
    }, [])

    return (
        <div className="monaco-editor-wrapper">
            <Editor
                height="100%"
                language={language}
                value={code}
                onChange={(value) => onChange(value ?? '')}
                onMount={handleMount}
                theme="vs-dark"
                loading={
                    <div className="monaco-loading">
                        <span className="monaco-loading__spinner">⚡</span>
                        <span>Loading editor...</span>
                    </div>
                }
                options={{
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    fontLigatures: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    renderLineHighlight: 'line',
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    smoothScrolling: true,
                    padding: { top: 12, bottom: 12 },
                    bracketPairColorization: { enabled: true },
                    guides: {
                        bracketPairs: true,
                        indentation: true,
                    },
                    suggest: {
                        showKeywords: true,
                        showSnippets: true,
                    },
                }}
            />
        </div>
    )
}
