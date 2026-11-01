# Hopz backend

Express 5 + Postgres (Neon). Contract for all 20 endpoints: [docs/api.md](docs/api.md).

## Setup

1. Install Node 20.10 or newer.
2. Create a Neon project and copy its connection string.
3. `cp .env.example .env` and fill `DATABASE_URL` and `JWT_SECRET`.
4. `npm install`
5. `npm run migrate` (safe to run twice)
6. `npm run seed` (optional demo users, password `password123`)
7. `npm run dev`

Tests (`npm test`) create and delete users with emails ending in `@hopz-test.local` only. Set `TEST_DATABASE_URL` (a separate Neon branch) to keep them off your dev data.

## Layers

A request flows `service` (route, auth, validation) → `business` (rules) → `datadomain` (SQL) → database. Never skip a layer or import upward. `models` shape rows into API objects, `function` holds pure helpers, `wrapper` talks to the outside world.

## Status

Endpoints 1–5 are implemented. 6–20 are wired (route, schema) with business and repository stubs that return `501` and carry step-by-step comments.
