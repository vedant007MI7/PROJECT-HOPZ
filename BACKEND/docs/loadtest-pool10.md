# Load test: pool10

One server process, 20 concurrent connections, 10 s per endpoint, target http://localhost:3000. Run 2026-11-18. Latency in milliseconds.

| Endpoint | req/s | p50 | p97.5 | p99 | failed |
|---|---|---|---|---|---|
| GET /health (no database, no Redis) | 42329 | 0 | 0 | 0 | 0 of 465589 |
| GET /health/db (1 database query) | 36 | 474 | 1665 | 1793 | 0 of 364 |
| GET /rides?limit=20 (1-2 database queries, logged in) | 10 | 1902 | 2324 | 2397 | 0 of 99 |
| POST /drivers/location (Redis; database about once a minute) | 267 | 59 | 62 | 62 | 0 of 2667 |
