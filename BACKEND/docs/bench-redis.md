# B5 benchmark: Postgres vs Redis (driver locations)

Run on 2026-11-18. Each number is milliseconds, p50 / p95, measured from this PC (so it includes the network round trip to Neon / Upstash).
Search = drivers within 5 km. Update = save one driver's new position. 200 searches and 300 updates per size.

## 1000 online drivers

| Operation | Postgres | Redis |
|---|---|---|
| Nearby search | 251.27 / 889.91 | 58.86 / 59.81 |
| Position update | 250.06 / 570.90 | 29.67 / 30.23 |

## 5000 online drivers

| Operation | Postgres | Redis |
|---|---|---|
| Nearby search | 250.69 / 816.26 | 58.96 / 60.60 |
| Position update | 250.03 / 569.58 | 29.76 / 30.18 |

Note: Redis answers searches from a geospatial index (distance-sorted); the SQL side is a bounding-box scan that still needs the haversine filter and sort in the app. Updates in the real app only hit Postgres about once a minute per driver.
