---
status: active
tags: [project, main, nodejs, express, mobile]
created: 2026-10-13
---
# PROJECT HOPZ

My main serious project: a mobile app backed by a layered Node.js + Express API.

## Run it
- `cd projects/project-hopz`, `npm install`, copy `.env.example` to `.env`
- `npm run dev` (auto-restart) or `npm start` → `http://localhost:3000/api/health`
- Example endpoints: `GET /api/users`, `GET /api/users/:id`, `POST /api/users` `{ name, email }`
- Every response: `{ success: true, data }` or `{ success: false, error }`

## Goals
- 

## Architecture
Requests flow top → bottom; each layer only calls the one below it.

| Layer | Folder | Role |
|---|---|---|
| [[wrapper]] | `wrapper/` | Thin adapters around external APIs, SDKs, libraries |
| [[service]] | `service/` | Entry points (API/endpoints/handlers) that orchestrate use cases |
| [[business]] | `business/` | Business rules, validation, workflows |
| [[function]] | `function/` | Reusable pure helper/utility functions |
| [[datadomain]] | `datadomain/` | Data access: repositories, DB queries, persistence |
| [[models]] | `models/` | Shared data shapes: entities, DTOs, enums (used by all layers) |

## Status
- 2026-10-13: Backend scaffold running (Express 5, CommonJS). Example `users` feature goes through every layer; data is in-memory (lost on restart). Smoke-tested: health, create, duplicate (409), invalid (400), not found (404).

## Decisions
- 2026-10-13: Layered structure (business, datadomain, function, models, service, wrapper) — keep concerns separated from day one.
- 2026-10-13: Stack = JavaScript, Node.js + Express for the mobile app's backend API — chosen by me.
- 2026-10-13: Express 5 — async route errors reach the central error handler without try/catch.
- 2026-10-13: In-memory repository for now — get the flow working before choosing a database.

## Next steps
- [ ] Define what HOPZ does (goals above) and its real models
- [ ] Choose a database (e.g. MongoDB / PostgreSQL) and replace the in-memory repo in [[datadomain]]
- [ ] Choose the mobile client (e.g. React Native / Expo) that calls this API
- [ ] Add auth (JWT), CORS, and tests

## Notes & links
- [[projects]]
