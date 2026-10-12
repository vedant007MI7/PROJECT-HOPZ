# service

Service layer: the public entry points (API endpoints, handlers, jobs) that receive requests and orchestrate use cases.

- Called by: clients / UI / [[wrapper]] entry adapters
- Uses: [[business]], [[models]]
- Handles input/output mapping; no business rules here.

## Contents
- `index.js`: mounts all routers under `/api`
- `health.routes.js`: `GET /api/health`
- `user.routes.js`: `GET /api/users`, `GET /api/users/:id`, `POST /api/users`

Part of [[project-hopz]].
