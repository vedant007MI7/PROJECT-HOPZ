# Load test: pool10-after

One server process, 20 concurrent connections, 10 s per endpoint, target http://localhost:3000. Run 2026-11-18. Latency in milliseconds.

| Endpoint | req/s | p50 | p97.5 | p99 | failed |
|---|---|---|---|---|---|
| GET /health (no database, no Redis) | 28291 | 0 | 0 | 0 | 0 of 311176 |
| GET /health/db (1 database query) | 37 | 476 | 1674 | 1877 | 0 of 365 |
| GET /rides?limit=20 (1-2 database queries, logged in) | 20 | 953 | 1335 | 1397 | 0 of 198 |
| POST /drivers/location (Redis; database about once a minute) | 288 | 59 | 63 | 65 | 0 of 2881 |
