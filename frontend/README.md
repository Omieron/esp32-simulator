# ESP32-S3 Simulator — Frontend

This folder contains the React + TypeScript + Vite UI for the **ESP32-S3 Simulator**:

- Monaco-based code editor
- Board view with placeable/wireable components
- Browser simulation runtime (Arduino-ish transpiler + JS runtime)
- WebSocket client (for the Go backend protocol)

For the full project overview and run instructions, see the root `README.md`.

## Development

```bash
npm ci
npm run dev
```

Vite runs on `http://localhost:5173` and proxies `/ws` to the Go backend (`ws://localhost:8080`) as configured in `vite.config.ts`.

## Tests

```bash
npm test
```
