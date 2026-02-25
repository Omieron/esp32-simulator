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
 * Transform C/C++ syntax constructs into valid JavaScript equivalents.
 */
function transformCppSyntax(body: string): string {
  let s = body

  // Array declarations: int/float/long/... name[] = {a, b, c}; → const name = [a, b, c];
  s = s.replace(/\b(?:int|float|double|long|unsigned|char|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|byte)\s+(\w+)\s*\[\s*\d*\s*\]\s*=\s*\{([^}]*)\}\s*;/g,
    (_match, name, values) => `const ${name} = [${values}];`)

  // for-loop: for (int/byte/... i = → for (let i =
  s = s.replace(/\bfor\s*\(\s*(?:int|float|double|long|unsigned|char|uint8_t|uint16_t|uint32_t|byte)\s+/g, 'for (let ')

  // Variable declarations: int x = val; → let x = val;
  s = s.replace(/\b(?:int|float|double|long|unsigned|char|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|byte)\s+(\w+)\s*=/g, 'let $1 =')

  // Uninitialized variable declarations: int x; → let x;
  s = s.replace(/\b(?:int|float|double|long|unsigned|char|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|byte)\s+(\w+)\s*;/g, 'let $1;')

  // bool → let
  s = s.replace(/\bbool\s+(\w+)\s*=/g, 'let $1 =')
  s = s.replace(/\bbool\s+(\w+)\s*;/g, 'let $1;')

  // String → let (Arduino String type)
  s = s.replace(/\bString\s+(\w+)\s*=/g, 'let $1 =')
  s = s.replace(/\bString\s+(\w+)\s*;/g, 'let $1;')

  // true/false are same in JS, no change needed

  return s
}

/**
 * Transform Arduino API calls to runtime calls.
 */
function transformToRuntime(body: string): string {
  let s = body

  // C/C++ syntax → JavaScript syntax (must run first)
  s = transformCppSyntax(s)

  // Replace delay( with await runtime.delay( (async)
  s = s.replace(/\bdelay\s*\(/g, 'await runtime.delay(')

  // Replace Arduino API functions
  s = s.replace(/\bpinMode\s*\(/g, 'runtime.pinMode(')
  s = s.replace(/\bdigitalWrite\s*\(/g, 'runtime.digitalWrite(')
  s = s.replace(/\bdigitalRead\s*\(/g, 'runtime.digitalRead(')
  s = s.replace(/\banalogWrite\s*\(/g, 'runtime.analogWrite(')
  s = s.replace(/\btone\s*\(/g, 'runtime.tone(')
  s = s.replace(/\bnoTone\s*\(/g, 'runtime.noTone(')
  s = s.replace(/\bSerial\.begin\s*\(/g, 'runtime.Serial.begin(')
  s = s.replace(/\bSerial\.println\s*\(/g, 'runtime.Serial.println(')

  // OLED display API (must come before Serial to avoid conflicts)
  s = s.replace(/\bdisplay\.begin\s*\(/g, 'runtime.display.begin(')
  s = s.replace(/\bdisplay\.clearDisplay\s*\(/g, 'runtime.display.clearDisplay(')
  s = s.replace(/\bdisplay\.display\s*\(/g, 'runtime.display.display(')
  s = s.replace(/\bdisplay\.setTextSize\s*\(/g, 'runtime.display.setTextSize(')
  s = s.replace(/\bdisplay\.setTextColor\s*\(/g, 'runtime.display.setTextColor(')
  s = s.replace(/\bdisplay\.setCursor\s*\(/g, 'runtime.display.setCursor(')
  s = s.replace(/\bdisplay\.println\s*\(/g, 'runtime.display.println(')
  s = s.replace(/\bdisplay\.print\s*\(/g, 'runtime.display.print(')
  s = s.replace(/\bdisplay\.drawPixel\s*\(/g, 'runtime.display.drawPixel(')
  s = s.replace(/\bdisplay\.drawString\s*\(/g, 'runtime.display.drawString(')
  s = s.replace(/\bdisplay\.drawLine\s*\(/g, 'runtime.display.drawLine(')
  s = s.replace(/\bdisplay\.drawRect\s*\(/g, 'runtime.display.drawRect(')
  s = s.replace(/\bdisplay\.fillRect\s*\(/g, 'runtime.display.fillRect(')
  s = s.replace(/\bdisplay\.drawCircle\s*\(/g, 'runtime.display.drawCircle(')
  s = s.replace(/\bdisplay\.fillCircle\s*\(/g, 'runtime.display.fillCircle(')

  // Wire I2C API
  s = s.replace(/\bWire\.begin\s*\(/g, 'runtime.Wire.begin(')

  // Replace constants (word boundary to avoid matching in strings)
  s = s.replace(/\bHIGH\b/g, 'runtime.HIGH')
  s = s.replace(/\bLOW\b/g, 'runtime.LOW')
  s = s.replace(/\bINPUT_PULLUP\b/g, 'runtime.INPUT_PULLUP')
  s = s.replace(/\bINPUT\b/g, 'runtime.INPUT')
  s = s.replace(/\bOUTPUT\b/g, 'runtime.OUTPUT')
  s = s.replace(/\bSSD1306_SWITCHCAPVCC\b/g, 'runtime.SSD1306_SWITCHCAPVCC')
  s = s.replace(/\bWHITE\b/g, 'runtime.WHITE')
  s = s.replace(/\bBLACK\b/g, 'runtime.BLACK')

  return s
}

/**
 * Extract global variable and array declarations outside setup()/loop().
 * Converts C types to JS and returns lines to inject at the top scope.
 */
function extractGlobalDeclarations(code: string): string[] {
  const lines: string[] = []

  // Strip #define, #include, comments, and function bodies to find top-level declarations
  let stripped = code
    .replace(/#\s*(?:define|include)\s+[^\n]*/g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')

  // Remove function bodies (void setup/loop and any other functions)
  const funcRegex = /\b\w+\s+\w+\s*\([^)]*\)\s*\{/g
  let fm
  while ((fm = funcRegex.exec(stripped)) !== null) {
    const start = fm.index
    let depth = 1
    let j = start + fm[0].length
    while (j < stripped.length && depth > 0) {
      if (stripped[j] === '{') depth++
      else if (stripped[j] === '}') depth--
      j++
    }
    stripped = stripped.slice(0, start) + stripped.slice(j)
    funcRegex.lastIndex = start
  }

  // Match array declarations: type name[] = {values};  (possibly multi-line)
  const arrRegex = /\b(?:int|float|double|long|unsigned|char|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|byte)\s+(\w+)\s*\[\s*\d*\s*\]\s*=\s*\{([^}]*)\}\s*;/g
  let am
  while ((am = arrRegex.exec(stripped)) !== null) {
    lines.push(`const ${am[1]} = [${am[2]}];`)
  }

  // Match simple variable declarations: type name = value;
  const varRegex = /\b(?:int|float|double|long|unsigned|char|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|byte|bool|String)\s+(\w+)\s*=\s*([^;]+);/g
  for (const vm of stripped.matchAll(varRegex)) {
    const name = vm[1]
    if (!lines.some(l => l.includes(`const ${name}`) || l.includes(`let ${name}`))) {
      lines.push(`let ${name} = ${vm[2].trim()};`)
    }
  }

  return lines
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

  const globalDecls = extractGlobalDeclarations(arduinoCode)
  const globalLines = globalDecls.join('\n  ')

  const setupCode = transformToRuntime(setupBody)
  const loopCode = transformToRuntime(loopBody)

  const jsCode = `(function(runtime) {
  ${defineLines}
  ${globalLines}

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
