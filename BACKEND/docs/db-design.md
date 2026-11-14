# Database design notes

How the Hopz database is shaped for speed, what was measured, and what would change at larger scale.
Numbers come from a Neon test branch seeded with about 150,000 rides and 22,000 users
(`scripts/bench-seed.js`, `scripts/bench-explain.js`). Full plans: `docs/bench-before.md` and `docs/bench-after.md`.

## What was measured and changed

The busiest rider in the data has 1,042 rides. Median of 5 runs.

| Query | Before | After | Why |
| --- | ---: | ---: | --- |
| Rider history, page 1 | 5.71 ms | 0.22 ms | Index holds rides in order, so no sort and no reading the whole history |
| Rider history, by cursor | 5.06 ms | 0.19 ms | Same, and the cursor jumps straight to the page |
| Driver history, page 1 | 0.54 ms | 0.18 ms | Same index idea on `driver_id` |
| Driver weekly earnings | 0.23 ms | 0.05 ms | Partial index on completed rides only |
| History with `OFFSET 800` | 5.90 ms | 5.91 ms | Unchanged: `OFFSET` still walks past every skipped row |
| Open requests near a driver | 0.67 ms | 0.64 ms | Already fast: few rows are ever open |
| Active ride check | 0.03 ms | 0.04 ms | Already served by the partial unique index |

Main finding: the old history query fetched, joined and sorted all of a user's rides just to return 20.
Its cost grew with the user's total rides, not with the page size.

## Indexes on `rides`

- `(rider_id, requested_at DESC, id DESC)` and `(driver_id, requested_at DESC, id DESC)`: history pages. The `id`
  breaks ties, so two rides with the same time keep a fixed order. These replace the single-column indexes on
  `rider_id` and `driver_id`, which are now redundant (an index on `(a, b)` also serves lookups on `a`).
- `(vehicle_type, requested_at) WHERE status = 'requested'`: a **partial index**. Open requests expire after a few
  minutes, so it holds a few hundred rows however large the table gets. It replaces the index on `status` alone,
  which had very few distinct values.
- `(driver_id, completed_at DESC) WHERE status = 'completed'`: driver earnings.
- Two partial unique indexes (one active ride per rider, one per driver) stay: they are rules, not just speed.

Every extra index slows each insert and update a little, so unused ones were removed rather than kept.

## Keyset (cursor) paging

`GET /rides?cursor=...` continues after the last ride seen: `WHERE (requested_at, id) < (cursor_time, cursor_id)`.
The index jumps to that spot, so page 50 costs the same as page 1. With `OFFSET`, page 50 reads and throws away 1,000 rows.
Trade-offs: no "jump to page 37", and the cursor must carry the exact timestamp (microseconds; a JavaScript Date
cuts it to milliseconds, so the cursor keeps the database's own text).

## Connections

Each server process keeps a pool (`PG_POOL_MAX`, default 10). Postgres connections are expensive (each is a
process with its own memory), and Neon limits them by plan size. With many instances the total
(instances x pool size) can exceed the limit, so on Render the app uses Neon's pooled connection string:
PgBouncer shares a few real connections between many app connections. Run migrations with the direct string.
A request waits at most 10 s for a free connection and fails clearly instead of hanging.

## What would change at larger scale (not built)

- **Read replica.** Reads such as history, earnings and ratings go to a replica; writes and anything that must see
  its own write (accept, payment verify) stay on the primary. The cost is replication lag: a rider might not see a
  ride they just finished for a moment, so read-your-own-writes paths use the primary.
- **Partitioning.** `ride_events` only grows. Partition it by month (`PARTITION BY RANGE (created_at)`): queries on
  recent data touch one small partition, and old months can be detached or archived cheaply instead of running a
  huge `DELETE`. The same applies to `rides` once old completed rides are rarely read.
- **Sharding.** Rides are naturally local, so shard by city or region (the shard key is the city of the pickup). A
  ride never spans shards, drivers only see requests in their city, and load spreads by city. The costs: cross-shard
  reports, uneven shards (a big city is hot), and moving a user who relocates. Do this last; vertical scaling,
  indexes, caching and replicas come first.
- **Caching hot reads** (a driver's average rating, fare tables) in Redis, covered separately in the plan.
