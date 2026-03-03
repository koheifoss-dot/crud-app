# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start with hot reload (nodemon + ts-node)
npm run build    # Compile TypeScript to dist/
npm start        # Run compiled output (requires build first)
```

## Architecture

Minimal Node.js HTTP server written in TypeScript with no web framework — uses only the native `http` module.

- **Entry point**: `src/server.ts`
- **Compiled output**: `dist/server.js`
- **Port**: 3000 (or `PORT` env var)

Current routes:
- `GET /` — plain text response
- `GET /health` — JSON health check
- All others — 404 JSON error

TypeScript config: ES2020 target, CommonJS modules, strict mode, `src/` → `dist/`.
