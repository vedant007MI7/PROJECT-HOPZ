# Hopz backend

REST API for Hopz, a ride-hailing app: riders book, drivers accept, the trip runs with a start PIN, and the fare is paid in cash or online (Razorpay test mode). Node.js, Express 5, Postgres (Neon), with optional Redis (Upstash) for live driver positions, caching, shared rate limits and background jobs, and Socket.IO for live updates. The full contract, with every endpoint, body and error, is in [docs/api.md](docs/api.md).

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
| `REDIS_URL` | no | Upstash Redis URL. Without it (or when Redis is down) everything falls back to Postgres and memory |
| `DRIVER_LOCATION_TTL_SECONDS` | no | How long a driver's live position stays valid in Redis, default 30 |
| `DRIVER_LOCATION_SAVE_SECONDS` | no | How often a driver's position is written to Postgres, default 60 |
| `QUEUE_ENABLED` | no | `true` runs reset codes, ride expiry and driver nudges as BullMQ jobs (needs `REDIS_URL`). Default off: the work runs inline |
| `QUEUE_DRAIN_DELAY_SECONDS` | no | How long an idle queue worker waits between polls, default 30 |
| `DISPATCH_WAVE_SIZE` | no | Drivers who see a new request first, default 3 |
| `DISPATCH_WAVE_SECONDS` | no | Seconds before the next wave of drivers sees it, default 15 |
| `DISPATCH_FULL_AFTER_SECONDS` | no | After this, every nearby driver sees it, default 60 |
| `SURGE_ENABLED` | no | `true` turns on surge pricing. Default off |
| `SURGE_RADIUS_KM` | no | Area around the pickup used to count demand and supply, default 3 |
| `SURGE_MAX_MULTIPLIER` | no | Highest surge multiplier, default 2 |
| `SOCKET_REDIS_ADAPTER` | no | `true` shares Socket.IO messages between several servers (needs `@socket.io/redis-adapter`; not tested, one instance is the supported setup) |
| `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS`, `OTP_RESEND_SECONDS` | no | Password-reset code lifetime, wrong guesses allowed and resend delay |
| `MAIL_FROM_NAME` | no | Display name on reset emails |
| `TEST_DATABASE_URL` | for tests | A separate Neon branch for `npm test` (note: the suite currently runs against `DATABASE_URL`, so migrate that database too) |
| `TEST_REDIS_URL`, `TEST_QUEUE_ENABLED` | for tests | Only for the optional real-Redis queue tests in `tests/queue-real.test.js` |

## Phase 2 features (B5 to B12)

Each one is a separate piece you can switch off. Without Redis the app still runs on Postgres alone.

**B5. Live driver position in Redis.** Drivers send their position every few seconds. It is kept in a Redis geospatial set (`drivers:geo`) plus a short-lived key per driver (30 s), and Postgres gets it about once a minute. One Redis round trip of three commands does the update. If Redis is missing or down (a circuit breaker opens after 3 failures for 15 s), matching falls back to a SQL bounding-box query. Metric: `hopz_redis_state`. In `scripts/bench-redis.js` a Redis update took about 30 to 59 ms against about 250 ms for Postgres, mostly network distance; the real gain is about one database write per driver per minute.

**B6. Shared rate limits.** The sign-up, login and ride-request limits count in Redis, so two servers share one count. Without Redis each process counts for itself.

**B7. Cache for driver earnings.** Cache-aside, 60 seconds per driver per day, deleted when that driver completes a ride. Metric: `hopz_cache_requests_total`.

**B8. Real-time updates (Socket.IO).** A JWT-checked connection; rooms `user:<id>` and `drivers`; events `ride:changed`, `requests:changed` and `driver:location`. Messages carry no private data; the app fetches the details. While the socket is up, the app polls every 15 s instead of 4 s. Metric: `hopz_socket_connections`.

**B9. Background jobs (BullMQ).** `send-reset-code`, `expire-ride` (delayed) and `nudge-drivers`, with 4 attempts and exponential backoff. Off unless `QUEUE_ENABLED=true` and `REDIS_URL` are set; if the queue is off or Redis fails, the same code runs inline. Metric: `hopz_queue_jobs`.

**B10. Dispatch in waves and surge pricing.** A new request is shown to the nearest 3 drivers first, 3 more every 15 s, and everyone after 60 s. Drivers who declined or are busy are skipped, and if the wave logic fails everyone sees the ride. Surge pricing (off by default) is demand over supply in 0.25 steps, capped at 2x, saved on the ride as `surge_multiplier`.

**B11. Load test and scaling notes.** `node scripts/loadtest.js --label <name>` runs autocannon against the main endpoints and writes a table to `docs/`. It found that expiring stale requests cost four database round trips per read; one SQL statement replaced them. `POST /rides` went from 10 to 20 requests per second, p50 from 1,902 ms to 953 ms and p99 from 2,397 ms to 1,397 ms. Details: [docs/loadtest-findings.md](docs/loadtest-findings.md) and [docs/scaling.md](docs/scaling.md).

**B12. Cancelling old logins.** Every user has a `token_version`, and each login token carries it. `POST /auth/change-password` and a password reset bump the version, and `POST /auth/logout-all` does it on demand, so every older token stops working and that user's sockets are disconnected. The version is cached for 30 s in memory and 5 min in Redis, so another server instance can take up to 30 s to notice. A wrong current password returns 400, not 401, because the app logs out on every 401.

## Scripts

- `npm run migrate` applies `datadomain/schema.sql` to `DATABASE_URL`; `npm run migrate:test` applies it to `TEST_DATABASE_URL`.
- `npm run seed` adds demo users. `node scripts/loadtest.js` and `node scripts/bench-redis.js` write benchmark tables to `docs/`.
- `npm test` runs the suite (one file at a time, because the tests share a database). It creates and deletes only users whose emails end in `@hopz-test.local`, and it never calls Razorpay or sends a message.

## Layers

A request flows `service` (route, auth, validation) → `business` (rules) → `datadomain` (SQL) → database. Never skip a layer or import upward. `models` shape rows into API objects, `function` holds pure helpers, `wrapper` talks to the outside world (database, Redis, cache, queue, Socket.IO, Razorpay, email, SMS).

## How the main rules are enforced

- **One driver wins a ride.** Accepting is a single `UPDATE ... WHERE status = 'requested'`, and a partial unique index allows one active ride per driver and per rider, even under races.
- **Ride states.** One table of allowed moves (`requested → accepted → arrived → started → completed`, with cancel before the start). Every change writes a `ride_events` row.
- **Start PIN.** Four digits, shown only to the rider; five wrong tries lock the start.
- **Unanswered requests expire.** A delayed job cancels them when the queue is on, and stale `requested` rides are also cancelled by the system the next time any request reads them (one SQL statement).
- **Safe retries.** `POST /rides` and the payment start take an optional `Idempotency-Key` header. The key is claimed with an `INSERT` on a primary key, so two parallel requests cannot both run, and a repeat gets the saved answer.
- **Outside services fail safely.** Razorpay and the email provider are called with a timeout, one retry for network errors and 5xx, and a circuit breaker: after 5 failures in a row calls fail at once for 30 s instead of waiting on a dead service. Payments answer a clear 503 (the app can offer cash). A slow query is stopped by `DB_STATEMENT_TIMEOUT_MS`, and on shutdown `/api/health` turns 503 while in-flight requests finish.
- **Every request is traceable.** Each gets an `X-Request-Id` (returned in the response header and on every log line for it), and `GET /metrics` shows request counts and latency by route, active rides, online drivers, database pool use, event-loop delay and circuit-breaker state, in Prometheus format.
- **Fare and distance are computed on the server.** The client never sends them.
- **Payments.** The server creates the Razorpay order from the ride's fare and marks a ride paid only after checking Razorpay's signature. One paid payment per ride is a database constraint.
- **Password reset.** A 6-digit code, stored only as a keyed hash, valid 10 minutes, locked after 5 wrong guesses, and the same reply whether or not the account exists.

## Deploying (Render)

Root directory `BACKEND`, build `npm install`, start `npm start`. Set the variables above in Render's Environment tab. The required ones are `DATABASE_URL` (production Neon branch, pooled host), `JWT_SECRET` and `NODE_ENV=production`; add `REDIS_URL` and `QUEUE_ENABLED=true` for the Redis features. Run `npm run migrate` once against the production database before the first deploy of a release: B10 adds `rides.surge_multiplier` and B12 adds `users.token_version`. A Neon child branch does not copy schema changes, so each branch needs its own migrate. The free tier sleeps when idle, so the first request after a pause can take up to a minute.

After deploying, check `GET /api/health` and `GET /api/health/db`.
