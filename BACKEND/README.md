# Hopz backend

REST API for Hopz, a ride-hailing app: riders book, drivers accept, the trip runs with a start PIN, and the fare is paid in cash or online (Razorpay test mode). Node.js, Express 5, Postgres (Neon). The full contract, with every endpoint, body and error, is in [docs/api.md](docs/api.md).

## Run it

1. Node 20.10 or newer.
2. Create a Neon project and copy its connection string.
3. `cp .env.example .env` and fill `DATABASE_URL` and `JWT_SECRET`.
4. `npm install`
5. `npm run migrate` (safe to run again; it only adds what is missing)
6. `npm run seed` (optional demo users, password `password123`)
7. `npm run dev`

Check it is up: `GET /api/health` and `GET /api/health/db`.

## Environment variables

| Name | Needed | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon connection string (keep `?sslmode=require`). On Render use the pooled one (host contains `-pooler`) |
| `JWT_SECRET` | yes | Signs login tokens and keys the password-reset code hashes |
| `JWT_EXPIRES_IN` | no | Token lifetime, default `7d` |
| `PIN_MAX_ATTEMPTS` | no | Wrong start PINs before a ride locks, default 5 |
| `NEARBY_RADIUS_KM` | no | How far a driver sees requests, default 5 |
| `RIDE_REQUEST_TIMEOUT_SECONDS` | no | A ride nobody accepts is cancelled after this, default 180 |
| `RIDE_CREATE_LIMIT_PER_MINUTE` | no | Ride requests one rider can make per minute, default 5 |
| `DB_STATEMENT_TIMEOUT_MS` | no | The database stops any single query running longer than this, default 15000 |
| `METRICS_TOKEN` | no | Protects `GET /metrics`: send `Authorization: Bearer <token>`. Without it, `/metrics` is open locally and hidden in production |
| `PG_POOL_MAX` | no | Most database connections one server process opens, default 10 |
| `CORS_ORIGINS` | no | Comma-separated allowed browser origins; empty allows all |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | for online payment | Razorpay **test** keys (`rzp_test_`) |
| `SMS_PROVIDER` | no | `log` (default) prints password-reset codes in the server log |
| `BREVO_API_KEY`, `MAIL_FROM` | for email codes | Sends the reset code by email through Brevo |
| `TEST_DATABASE_URL` | for tests | A separate Neon branch for `npm test` |

## Redis (driver locations)
Drivers send their position every few seconds. That live position is kept in Redis (a geospatial set plus a short-lived key per driver); Postgres gets it about once a minute. Redis is optional: without `REDIS_URL`, or when Redis is down (circuit breaker), everything falls back to Postgres. Settings: `REDIS_URL`, `DRIVER_LOCATION_TTL_SECONDS` (30), `DRIVER_LOCATION_SAVE_SECONDS` (60). Tests use a fake Redis; set `TEST_REDIS_URL` to point at a real one. Metric: `hopz_redis_state`.

## Scripts

- `npm run migrate` applies `datadomain/schema.sql` to `DATABASE_URL`; `npm run migrate:test` applies it to `TEST_DATABASE_URL`.
- `npm test` runs the suite. It creates and deletes only users whose emails end in `@hopz-test.local`, and it never calls Razorpay or sends a message.

## Layers

A request flows `service` (route, auth, validation) → `business` (rules) → `datadomain` (SQL) → database. Never skip a layer or import upward. `models` shape rows into API objects, `function` holds pure helpers, `wrapper` talks to the outside world (database, Razorpay, email, SMS).

## How the main rules are enforced

- **One driver wins a ride.** Accepting is a single `UPDATE ... WHERE status = 'requested'`, and a partial unique index allows one active ride per driver and per rider, even under races.
- **Ride states.** One table of allowed moves (`requested → accepted → arrived → started → completed`, with cancel before the start). Every change writes a `ride_events` row.
- **Start PIN.** Four digits, shown only to the rider; five wrong tries lock the start.
- **Unanswered requests expire.** Stale `requested` rides are cancelled by the system the next time any request reads them.
- **Safe retries.** `POST /rides` and the payment start take an optional `Idempotency-Key` header. The key is claimed with an `INSERT` on a primary key, so two parallel requests cannot both run, and a repeat gets the saved answer.
- **Outside services fail safely.** Razorpay and the email provider are called with a timeout, one retry for network errors and 5xx, and a circuit breaker: after 5 failures in a row calls fail at once for 30 s instead of waiting on a dead service. Payments answer a clear 503 (the app can offer cash). A slow query is stopped by `DB_STATEMENT_TIMEOUT_MS`, and on shutdown `/api/health` turns 503 while in-flight requests finish.
- **Every request is traceable.** Each gets an `X-Request-Id` (returned in the response header and on every log line for it), and `GET /metrics` shows request counts and latency by route, active rides, online drivers, database pool use, event-loop delay and circuit-breaker state, in Prometheus format.
- **Fare and distance are computed on the server.** The client never sends them.
- **Payments.** The server creates the Razorpay order from the ride's fare and marks a ride paid only after checking Razorpay's signature. One paid payment per ride is a database constraint.
- **Password reset.** A 6-digit code, stored only as a keyed hash, valid 10 minutes, locked after 5 wrong guesses, and the same reply whether or not the account exists.

## Deploying (Render)

Root directory `BACKEND`, build `npm install`, start `npm start`. Set the variables above in Render's Environment tab, then run `npm run migrate` once against the main database. The free tier sleeps when idle, so the first request after a pause can take up to a minute.
