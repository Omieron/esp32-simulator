/**
 * Simple Arduino C++ → JavaScript transpiler for ESP32-S3 Simulator.
 * Extracts setup() and loop(), maps Arduino API to runtime calls.
 */

export interface TranspileResult {
  success: boolean
  jsCode?: string
  error?: string
}

/**
 * Extract body of a void function (setup or loop) by matching braces.
 */
function extractFunctionBody(code: string, name: 'setup' | 'loop'): string | null {
  const regex = new RegExp(`void\\s+${name}\\s*\\(\\s*\\)\\s*\\{`, 'i')
  const match = code.match(regex)
  if (!match || match.index === undefined) return null

  const start = match.index + match[0].length
  let depth = 1
  let i = start
  while (i < code.length && depth > 0) {
    const c = code[i]
    if (c === '"' || c === "'") {
      const quote = c
      i++
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    if (c === '{') depth++
    if (c === '}') depth--
    i++
  }
  return depth === 0 ? code.slice(start, i - 1).trim() : null
}

/**
 * Extract #define NAME value (numeric only).
 */
function extractDefines(code: string): Map<string, string> {
  const defines = new Map<string, string>()
  const regex = /#define\s+(\w+)\s+(\d+)/g
  let m
  while ((m = regex.exec(code)) !== null) {
    defines.set(m[1], m[2])
  }
  return defines
}

/**
 * Transform Arduino API calls to runtime calls.
 */
function transformToRuntime(body: string): string {
  let s = body

  // Replace delay( with await runtime.delay( (async)
  s = s.replace(/\bdelay\s*\(/g, 'await runtime.delay(')

  // Replace Arduino API functions
  s = s.replace(/\bpinMode\s*\(/g, 'runtime.pinMode(')
  s = s.replace(/\bdigitalWrite\s*\(/g, 'runtime.digitalWrite(')
  s = s.replace(/\bdigitalRead\s*\(/g, 'runtime.digitalRead(')
  s = s.replace(/\banalogWrite\s*\(/g, 'runtime.analogWrite(')
  s = s.replace(/\bSerial\.begin\s*\(/g, 'runtime.Serial.begin(')
  s = s.replace(/\bSerial\.println\s*\(/g, 'runtime.Serial.println(')

  // Replace constants (word boundary to avoid matching in strings)
  s = s.replace(/\bHIGH\b/g, 'runtime.HIGH')
  s = s.replace(/\bLOW\b/g, 'runtime.LOW')
  s = s.replace(/\bINPUT\b/g, 'runtime.INPUT')
  s = s.replace(/\bOUTPUT\b/g, 'runtime.OUTPUT')
  s = s.replace(/\bINPUT_PULLUP\b/g, 'runtime.INPUT_PULLUP')

  return s
}

/**
 * Transpile Arduino code to JavaScript.
 * Returns executable JS that expects `runtime` and `running` in scope.
 */
export function transpile(arduinoCode: string): TranspileResult {
  const setupBody = extractFunctionBody(arduinoCode, 'setup')
  const loopBody = extractFunctionBody(arduinoCode, 'loop')

  if (!setupBody) {
    return { success: false, error: 'Could not find setup() function' }
  }
  if (!loopBody) {
    return { success: false, error: 'Could not find loop() function' }
  }

  const defines = extractDefines(arduinoCode)
  const defineLines = Array.from(defines.entries())
    .map(([name, value]) => `const ${name} = ${value};`)
    .join('\n')

  const setupCode = transformToRuntime(setupBody)
  const loopCode = transformToRuntime(loopBody)

  const jsCode = `(function(runtime) {
  ${defineLines}

  async function setup() {
    ${setupCode}
  }

  async function loop() {
    ${loopCode}
  }

  return { setup, loop };
})`

  return { success: true, jsCode: jsCode.trim() }
}
