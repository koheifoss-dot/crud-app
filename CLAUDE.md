# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start with hot reload (nodemon + ts-node)
npm run build    # Compile TypeScript to dist/
npm start        # Run compiled output (requires build first)
```

## Architecture

Node.js HTTP server built with **Express** and **TypeScript**. Data persists to a local `tasks.db` SQLite file via `better-sqlite3`. Frontend is a single static HTML file served from `public/`.

- **Entry point**: `src/server.ts`
- **Compiled output**: `dist/server.js`
- **Frontend**: `public/index.html` (vanilla JS, no build step)
- **Database**: `tasks.db` (SQLite, auto-created on first run)
- **Port**: 3000 (or `PORT` env var)

### Dependencies
- `express` — HTTP routing and static file serving
- `better-sqlite3` — synchronous SQLite driver

### Routes
- `GET /` — serves `public/index.html`
- `GET /health` — JSON health check
- `GET /api/tasks` — list all tasks
- `POST /api/tasks` — create a task (`{ title, startDate?, endDate?, dueDate? }`)
- `PUT /api/tasks/:id` — update a task (any fields)
- `DELETE /api/tasks/:id` — delete a task

TypeScript config: ES2020 target, CommonJS modules, strict mode, `src/` → `dist/`.
