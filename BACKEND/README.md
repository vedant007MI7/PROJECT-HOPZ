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
| `DATABASE_URL` | yes | Neon connection string (keep `?sslmode=require`) |
| `JWT_SECRET` | yes | Signs login tokens and keys the password-reset code hashes |
| `JWT_EXPIRES_IN` | no | Token lifetime, default `7d` |
| `PIN_MAX_ATTEMPTS` | no | Wrong start PINs before a ride locks, default 5 |
| `NEARBY_RADIUS_KM` | no | How far a driver sees requests, default 5 |
| `RIDE_REQUEST_TIMEOUT_SECONDS` | no | A ride nobody accepts is cancelled after this, default 180 |
| `CORS_ORIGINS` | no | Comma-separated allowed browser origins; empty allows all |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | for online payment | Razorpay **test** keys (`rzp_test_`) |
| `SMS_PROVIDER` | no | `log` (default) prints password-reset codes in the server log |
| `BREVO_API_KEY`, `MAIL_FROM` | for email codes | Sends the reset code by email through Brevo |
| `TEST_DATABASE_URL` | for tests | A separate Neon branch for `npm test` |

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
- **Fare and distance are computed on the server.** The client never sends them.
- **Payments.** The server creates the Razorpay order from the ride's fare and marks a ride paid only after checking Razorpay's signature. One paid payment per ride is a database constraint.
- **Password reset.** A 6-digit code, stored only as a keyed hash, valid 10 minutes, locked after 5 wrong guesses, and the same reply whether or not the account exists.

## Deploying (Render)

Root directory `BACKEND`, build `npm install`, start `npm start`. Set the variables above in Render's Environment tab, then run `npm run migrate` once against the main database. The free tier sleeps when idle, so the first request after a pause can take up to a minute.
