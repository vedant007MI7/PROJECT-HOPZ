# Load test findings (B11)

Method: `node scripts/loadtest.js`, one server process on a laptop, 20 concurrent connections, 10 s per endpoint,
database = Neon (about 250 ms round trip from the laptop), Redis = Upstash (about 30 ms). Raw tables:
`loadtest-pool10.md` (before) and `loadtest-pool10-after.md` (after).

## What the numbers say

| Endpoint | req/s | What limits it |
|---|---|---|
| `GET /health` | 28,000 to 42,000 | Node and Express themselves: no database, no Redis |
| `POST /drivers/location` | ~270 to 290 | Redis round trip (about 30 ms) and the login check |
| `GET /health/db` | ~36 | **Little's law**: pool of 10 connections / ~0.25 s per query = 40 req/s |
| `GET /rides?limit=20` | **10, then 20 after the fix** | database round trips per request |

The ceiling for anything that touches the database is `pool size / (round trips x time per round trip)`.
It is set by the distance to the database, not by CPU. Putting the server in the same region as the database would
raise every database row about 50x.

## The finding: `GET /rides` was 4x slower than one query

Expected about 36 req/s (one query like `/health/db`), measured 10 req/s at p50 = 1.9 s.

Cause: every read of rides first runs the lazy "cancel unanswered requests" cleanup, written as a transaction:
connect, `BEGIN`, `UPDATE`, one `INSERT` per cancelled ride, `COMMIT`. That is about 4 round trips, to do nothing,
almost every time, before the real list query.

Fix: the same cleanup as ONE statement (`WITH stale AS (UPDATE ... RETURNING ...) INSERT INTO ride_events ...`).
One round trip, still atomic (the cancel and its event happen together or not at all).

Result: **10 to 20 req/s, p50 1,902 ms to 953 ms, p99 2,397 ms to 1,397 ms.** The other endpoints did not change,
which shows it was this change.

## What would help next

- Run the server near the database (same region). Biggest win, no code change.
- Skip the cleanup when the delayed `expire-ride` job (BullMQ) is on, since the job already cancels each request on
  time. The cleanup would then run only as a fallback.
- A pool larger than 10 raises the ceiling until the database's connection limit; the pooled Neon URL (`-pooler`)
  makes that safe.
