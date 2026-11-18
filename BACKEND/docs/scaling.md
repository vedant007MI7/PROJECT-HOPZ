# Scaling the Hopz backend

What happens when there is more than one server, or a lot more traffic? This page lists what is shared, what is
per-process, and what would break first. Load-test numbers are in `docs/loadtest-*.md` (run `scripts/loadtest.js`).

## 1. Can I run more than one instance?

Yes, as long as no request depends on what an earlier request left in *this* process's memory. Where each piece of
state lives:

| State | Where it lives | With 3 instances |
|---|---|---|
| Rides, users, payments | Postgres | shared |
| Driver live positions | Redis (geo set + keys) | shared |
| Rate-limit counters | Redis (`wrapper/rate-limit-store.js`) | shared; falls back to per-process counting if Redis is down |
| Cached earnings | Redis (`wrapper/cache.js`) | shared |
| Background jobs | Redis (BullMQ) | shared; any instance's worker can take a job, each job runs once |
| Idempotency keys | Postgres | shared |
| Socket.IO connections | memory of the instance the phone connected to | **needs the Redis adapter** (`SOCKET_REDIS_ADAPTER=true`), otherwise an event only reaches phones on the same instance |
| Circuit breakers, metrics counters | memory | per instance on purpose: each instance sees its own failures. `/metrics` is scraped per instance |
| Vehicle-type cache, in-flight cache calls | memory | per instance, harmless: they only save work |
| Sessions | none: the JWT is verified without a lookup | nothing to share |

So the API is stateless apart from the WebSocket connections, and those are handled by the adapter.

## 2. The database is the first bottleneck (and why)

Every instance has its own pool of `PG_POOL_MAX` connections (default 10). A connection runs one query at a time,
so the most queries per second a pool can do is:

    queries/s  <=  pool size / time per query     (Little's law: concurrency = throughput x latency)

From a PC in India to the Neon database the round trip is about 250 ms, so a pool of 10 gives at most about
10 / 0.25 = 40 queries per second per instance, however fast the CPU is. Measured in `loadtest-*.md`: the
endpoints that touch the database stop growing at that ceiling, while `/health` (no database) and
`POST /drivers/location` (Redis) go much higher. Two ways to raise the ceiling:

1. Put the server near the database (same region). The query time drops from 250 ms to a few ms, which raises the
   ceiling by 50x with no code change. This is the cheapest fix by far.
2. A bigger pool, or more instances. This only helps until the database's own connection limit: Neon's free plan
   allows few direct connections, which is why the pooled connection string (`-pooler`, PgBouncer) is used on
   Render: many app connections share a few real ones.

## 3. What was done so far to keep load off the database

| Hot path | Before | Now |
|---|---|---|
| Driver position updates (every few seconds per driver) | 1 write per update | Redis only; 1 write per minute per driver |
| Nearby-driver search | scan of the drivers table | Redis geo index, same speed at 1,000 and 5,000 drivers |
| Ride history | sort of a user's whole history | composite index + keyset paging (~26x faster at 150k rides) |
| Earnings screen | weekly aggregate on every open | cached 60 s, deleted when a ride completes |
| Rate limiting | in each process | shared in Redis |
| Rider seeing the driver move | poll every 4 s | pushed over a WebSocket; poll every 15 s as a fallback |
| Emails/SMS | inside the request | queued job with retries |

## 4. What would break next, and what I would do

1. **Database connections.** Fix: pooled URL, then read replicas for reads (ride history, earnings) while writes
   stay on the primary. Replica lag means a just-finished ride might be missing for a moment, so only reads that can
   tolerate that go there.
2. **One Postgres primary for writes.** Fix: partition `rides` by time (old rides are rarely read), archive old
   `ride_events`. Much later: shard by city, since a ride never crosses cities.
3. **One Redis.** Fix: Redis Cluster or one Redis per city for the geo data. The geo set is per city anyway.
4. **WebSocket fan-out.** Each instance holds its connections (memory per socket is small, but file descriptors
   and heartbeats add up). Fix: the Redis adapter, then sticky sessions or WebSocket-only transport (already
   `transports: ['websocket']` in the app, so no sticky-session problem), and a limit on connections per instance.
5. **Matching quality.** Wave dispatch is greedy and per request. At large scale it becomes batch matching (assign a
   set of riders to a set of drivers together every few seconds).

## 5. Deploy checklist for N instances

- `REDIS_URL` set on all of them (rate limits, cache, queue, locations all depend on it being shared).
- `SOCKET_REDIS_ADAPTER=true` and `npm install @socket.io/redis-adapter`.
- `QUEUE_ENABLED=true` on all (any instance's worker may run a job). Watch Redis command usage on the free tier.
- Neon pooled connection string; `PG_POOL_MAX` x instances below the database's connection limit.
- Migrations are additive (new columns have defaults), so old and new versions can run side by side during a deploy.
- `/api/health` goes 503 while an instance drains, so the load balancer stops sending it requests during shutdown.
