# Query benchmark: before

Test database, about 150,000 rides, 22,000 users. Median of 5 runs after a warm-up.

| Query | Median ms | Buffers | Rows | Plan steps |
| --- | ---: | ---: | ---: | --- |
| Driver polls open requests (listRequestedInBox) | 0.67 | 122 | 27 | Limit > Sort > Nested Loop > Hash Join > Nested Loop > Nested Loop > Index Scan using idx_rides_status on rides > Index Scan using users_pkey on users > Index Scan using users_pkey on users > Hash > Seq Scan on driver_profiles > Materialize > Index Only Scan using idx_ride_events_decline on ride_events |
| Expire stale requests (cancelStaleRequested, rolled back) | 4.06 | 4546 | 300 | ModifyTable on rides > Index Scan using idx_rides_status on rides |
| Rider history, page 1 (OFFSET 0) | 5.71 | 365 | 20 | Limit > Sort > Hash Join > Hash Join > Nested Loop > Bitmap Heap Scan on rides > Bitmap Index Scan using idx_rides_rider > Materialize > Index Scan using users_pkey on users > Hash > Seq Scan on users > Hash > Seq Scan on driver_profiles |
| Rider history, deep page (OFFSET 800) | 5.90 | 365 | 20 | Limit > Sort > Hash Join > Hash Join > Nested Loop > Bitmap Heap Scan on rides > Bitmap Index Scan using idx_rides_rider > Materialize > Index Scan using users_pkey on users > Hash > Seq Scan on users > Hash > Seq Scan on driver_profiles |
| Rider history, same page by keyset cursor | 5.06 | 365 | 20 | Limit > Sort > Hash Join > Hash Join > Nested Loop > Bitmap Heap Scan on rides > Bitmap Index Scan using idx_rides_rider > Materialize > Index Scan using users_pkey on users > Hash > Seq Scan on users > Hash > Seq Scan on driver_profiles |
| Driver history, page 1 | 0.54 | 426 | 20 | Limit > Sort > Nested Loop > Nested Loop > Nested Loop > Bitmap Heap Scan on rides > Bitmap Index Scan using idx_rides_driver > Index Scan using users_pkey on users > Materialize > Index Scan using users_pkey on users > Materialize > Index Scan using driver_profiles_pkey on driver_profiles |
| Driver weekly earnings (listCompletedThisWeek) | 0.23 | 105 | 1 | Sort > Bitmap Heap Scan on rides > Bitmap Index Scan using idx_rides_driver |
| Driver average rating (summaryForDriver) | 0.06 | 9 | 1 | Aggregate > Nested Loop > Seq Scan on ratings > Index Scan using rides_pkey on rides |
| Rider has an active ride? (findActiveByRider) | 0.03 | 3 | 1 | Limit > Index Scan using ux_rides_rider_active on rides |

## Full plans

### Driver polls open requests (listRequestedInBox)

```
Limit  (cost=1044.07..1044.14 rows=26 width=306) (actual time=0.610..0.615 rows=27.00 loops=1)
  Buffers: shared hit=122
  ->  Sort  (cost=1044.07..1044.14 rows=26 width=306) (actual time=0.609..0.611 rows=27.00 loops=1)
        Sort Key: r.requested_at
        Sort Method: quicksort  Memory: 31kB
        Buffers: shared hit=122
        ->  Nested Loop Anti Join  (cost=74.21..1043.46 rows=26 width=306) (actual time=0.450..0.596 rows=27.00 loops=1)
              Join Filter: (e.ride_id = r.id)
              Buffers: shared hit=122
              ->  Hash Left Join  (cost=73.94..1034.78 rows=26 width=306) (actual time=0.444..0.582 rows=27.00 loops=1)
                    Hash Cond: (r.driver_id = dp.user_id)
                    Buffers: shared hit=119
                    ->  Nested Loop Left Join  (cost=0.87..961.65 rows=26 width=265) (actual time=0.016..0.150 rows=27.00 loops=1)
                          Buffers: shared hit=91
                          ->  Nested Loop Left Join  (cost=0.58..757.71 rows=26 width=234) (actual time=0.015..0.140 rows=27.00 loops=1)
                                Buffers: shared hit=91
                                ->  Index Scan using idx_rides_status on rides r  (cost=0.29..553.78 rows=26 width=203) (actual time=0.010..0.079 rows=27.00 loops=1)
                                      Index Cond: (status = 'requested'::text)
                                      Filter: ((pickup_lat >= '28.5'::double precision) AND (pickup_lat <= '28.7'::double precision) AND (pickup_lng >= '77.1'::double precision) AND (pickup_lng <= '77.3'::double precision) AND (vehicle_type = 'mini'::text))
                                      Rows Removed by Filter: 273
                                      Index Searches: 1
                                      Buffers: shared hit=10
                                ->  Index Scan using users_pkey on users ru  (cost=0.29..7.84 rows=1 width=47) (actual time=0.002..0.002 rows=1.00 loops=27)
                                      Index Cond: (id = r.rider_id)
                                      Index Searches: 27
                                      Buffers: shared hit=81
                          ->  Index Scan using users_pkey on users u  (cost=0.29..7.84 rows=1 width=47) (actual time=0.000..0.000 rows=0.00 loops=27)
                                Index Cond: (id = r.driver_id)
                                Index Searches: 0
                    ->  Hash  (cost=48.03..48.03 rows=2003 width=57) (actual time=0.424..0.425 rows=2003.00 loops=1)
                          Buckets: 2048  Batches: 1  Memory Usage: 204kB
                          Buffers: shared hit=28
                          ->  Seq Scan on driver_profiles dp  (cost=0.00..48.03 rows=2003 width=57) (actual time=0.006..0.186 rows=2003.00 loops=1)
                                Buffers: shared hit=28
              ->  Materialize  (cost=0.27..8.30 rows=1 width=16) (actual time=0.000..0.000 rows=0.00 loops=27)
                    Storage: Memory  Maximum Storage: 17kB
                    Buffers: shared hit=3
                    ->  Index Only Scan using idx_ride_events_decline on ride_events e  (cost=0.27..8.29 rows=1 width=16) (actual time=0.004..0.004 rows=0.00 loops=1)
                          Index Cond: (actor_id = '939d4655-f197-4f0b-aca3-1eb2ab7b4f75'::uuid)
                          Heap Fetches: 0
                          Index Searches: 1
                          Buffers: shared hit=3
Planning:
  Buffers: shared hit=59
Planning Time: 1.013 ms
Execution Time: 0.670 ms
```

### Expire stale requests (cancelStaleRequested, rolled back)

```
Update on rides  (cost=0.29..558.51 rows=309 width=78) (actual time=0.142..4.346 rows=300.00 loops=1)
  Buffers: shared hit=4572 dirtied=10 written=10
  ->  Index Scan using idx_rides_status on rides  (cost=0.29..558.51 rows=309 width=78) (actual time=0.025..0.157 rows=300.00 loops=1)
        Index Cond: (status = 'requested'::text)
        Filter: (requested_at < (now() - '00:01:00'::interval))
        Index Searches: 1
        Buffers: shared hit=10
Planning Time: 0.108 ms
Execution Time: 4.400 ms
```

### Rider history, page 1 (OFFSET 0)

```
Limit  (cost=3314.40..3314.45 rows=20 width=306) (actual time=5.652..5.657 rows=20.00 loops=1)
  Buffers: shared hit=365
  ->  Sort  (cost=3314.40..3316.94 rows=1016 width=306) (actual time=5.651..5.654 rows=20.00 loops=1)
        Sort Key: r.requested_at DESC, r.id
        Sort Method: top-N heapsort  Memory: 41kB
        Buffers: shared hit=365
        ->  Hash Left Join  (cost=878.66..3287.36 rows=1016 width=306) (actual time=4.379..5.314 rows=1043.00 loops=1)
              Hash Cond: (r.driver_id = dp.user_id)
              Buffers: shared hit=365
              ->  Hash Left Join  (cost=805.59..3211.62 rows=1016 width=265) (actual time=3.933..4.613 rows=1043.00 loops=1)
                    Hash Cond: (r.driver_id = u.id)
                    Buffers: shared hit=337
                    ->  Nested Loop Left Join  (cost=16.46..2419.82 rows=1016 width=234) (actual time=0.041..0.481 rows=1043.00 loops=1)
                          Buffers: shared hit=43
                          ->  Bitmap Heap Scan on rides r  (cost=16.17..2398.81 rows=1016 width=203) (actual time=0.033..0.246 rows=1043.00 loops=1)
                                Recheck Cond: (rider_id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                Heap Blocks: exact=38
                                Buffers: shared hit=40
                                ->  Bitmap Index Scan on idx_rides_rider  (cost=0.00..15.91 rows=1016 width=0) (actual time=0.020..0.020 rows=1050.00 loops=1)
                                      Index Cond: (rider_id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                      Index Searches: 1
                                      Buffers: shared hit=2
                          ->  Materialize  (cost=0.29..8.31 rows=1 width=47) (actual time=0.000..0.000 rows=1.00 loops=1043)
                                Storage: Memory  Maximum Storage: 17kB
                                Buffers: shared hit=3
                                ->  Index Scan using users_pkey on users ru  (cost=0.29..8.30 rows=1 width=47) (actual time=0.005..0.005 rows=1.00 loops=1)
                                      Index Cond: (id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                      Index Searches: 1
                                      Buffers: shared hit=3
                    ->  Hash  (cost=514.06..514.06 rows=22006 width=47) (actual time=3.883..3.884 rows=22006.00 loops=1)
                          Buckets: 32768  Batches: 1  Memory Usage: 1663kB
                          Buffers: shared hit=294
                          ->  Seq Scan on users u  (cost=0.00..514.06 rows=22006 width=47) (actual time=0.005..1.702 rows=22006.00 loops=1)
                                Buffers: shared hit=294
              ->  Hash  (cost=48.03..48.03 rows=2003 width=57) (actual time=0.443..0.443 rows=2003.00 loops=1)
                    Buckets: 2048  Batches: 1  Memory Usage: 204kB
                    Buffers: shared hit=28
                    ->  Seq Scan on driver_profiles dp  (cost=0.00..48.03 rows=2003 width=57) (actual time=0.007..0.182 rows=2003.00 loops=1)
                          Buffers: shared hit=28
Planning:
  Buffers: shared hit=32
Planning Time: 0.445 ms
Execution Time: 5.715 ms
```

### Rider history, deep page (OFFSET 800)

```
Limit  (cost=3340.11..3340.16 rows=20 width=306) (actual time=6.800..6.807 rows=20.00 loops=1)
  Buffers: shared hit=365
  ->  Sort  (cost=3338.11..3340.65 rows=1016 width=306) (actual time=6.689..6.769 rows=820.00 loops=1)
        Sort Key: r.requested_at DESC, r.id
        Sort Method: quicksort  Memory: 578kB
        Buffers: shared hit=365
        ->  Hash Left Join  (cost=878.66..3287.36 rows=1016 width=306) (actual time=5.107..6.260 rows=1043.00 loops=1)
              Hash Cond: (r.driver_id = dp.user_id)
              Buffers: shared hit=365
              ->  Hash Left Join  (cost=805.59..3211.62 rows=1016 width=265) (actual time=4.638..5.461 rows=1043.00 loops=1)
                    Hash Cond: (r.driver_id = u.id)
                    Buffers: shared hit=337
                    ->  Nested Loop Left Join  (cost=16.46..2419.82 rows=1016 width=234) (actual time=0.045..0.572 rows=1043.00 loops=1)
                          Buffers: shared hit=43
                          ->  Bitmap Heap Scan on rides r  (cost=16.17..2398.81 rows=1016 width=203) (actual time=0.036..0.315 rows=1043.00 loops=1)
                                Recheck Cond: (rider_id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                Heap Blocks: exact=38
                                Buffers: shared hit=40
                                ->  Bitmap Index Scan on idx_rides_rider  (cost=0.00..15.91 rows=1016 width=0) (actual time=0.021..0.021 rows=1050.00 loops=1)
                                      Index Cond: (rider_id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                      Index Searches: 1
                                      Buffers: shared hit=2
                          ->  Materialize  (cost=0.29..8.31 rows=1 width=47) (actual time=0.000..0.000 rows=1.00 loops=1043)
                                Storage: Memory  Maximum Storage: 17kB
                                Buffers: shared hit=3
                                ->  Index Scan using users_pkey on users ru  (cost=0.29..8.30 rows=1 width=47) (actual time=0.005..0.005 rows=1.00 loops=1)
                                      Index Cond: (id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                      Index Searches: 1
                                      Buffers: shared hit=3
                    ->  Hash  (cost=514.06..514.06 rows=22006 width=47) (actual time=4.577..4.578 rows=22006.00 loops=1)
                          Buckets: 32768  Batches: 1  Memory Usage: 1663kB
                          Buffers: shared hit=294
                          ->  Seq Scan on users u  (cost=0.00..514.06 rows=22006 width=47) (actual time=0.006..2.112 rows=22006.00 loops=1)
                                Buffers: shared hit=294
              ->  Hash  (cost=48.03..48.03 rows=2003 width=57) (actual time=0.463..0.464 rows=2003.00 loops=1)
                    Buckets: 2048  Batches: 1  Memory Usage: 204kB
                    Buffers: shared hit=28
                    ->  Seq Scan on driver_profiles dp  (cost=0.00..48.03 rows=2003 width=57) (actual time=0.013..0.210 rows=2003.00 loops=1)
                          Buffers: shared hit=28
Planning:
  Buffers: shared hit=32
Planning Time: 0.486 ms
Execution Time: 6.881 ms
```

### Rider history, same page by keyset cursor

```
Limit  (cost=3283.96..3284.01 rows=20 width=306) (actual time=4.929..4.935 rows=20.00 loops=1)
  Buffers: shared hit=365
  ->  Sort  (cost=3283.96..3284.51 rows=220 width=306) (actual time=4.927..4.931 rows=20.00 loops=1)
        Sort Key: r.requested_at DESC, r.id DESC
        Sort Method: top-N heapsort  Memory: 43kB
        Buffers: shared hit=365
        ->  Hash Left Join  (cost=878.46..3278.11 rows=220 width=306) (actual time=4.525..4.840 rows=242.00 loops=1)
              Hash Cond: (r.driver_id = dp.user_id)
              Buffers: shared hit=365
              ->  Hash Left Join  (cost=805.39..3204.46 rows=220 width=265) (actual time=4.094..4.359 rows=242.00 loops=1)
                    Hash Cond: (r.driver_id = u.id)
                    Buffers: shared hit=337
                    ->  Nested Loop Left Join  (cost=16.26..2414.75 rows=220 width=234) (actual time=0.043..0.260 rows=242.00 loops=1)
                          Buffers: shared hit=43
                          ->  Bitmap Heap Scan on rides r  (cost=15.97..2403.69 rows=220 width=203) (actual time=0.035..0.195 rows=242.00 loops=1)
                                Recheck Cond: (rider_id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                Filter: (ROW(requested_at, id) < ROW('2026-01-31 09:48:43.789+00'::timestamp with time zone, 'c2a8c278-0f5f-4ba1-9a82-f4ab3d7b2d82'::uuid))
                                Rows Removed by Filter: 801
                                Heap Blocks: exact=38
                                Buffers: shared hit=40
                                ->  Bitmap Index Scan on idx_rides_rider  (cost=0.00..15.91 rows=1016 width=0) (actual time=0.020..0.020 rows=1050.00 loops=1)
                                      Index Cond: (rider_id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                      Index Searches: 1
                                      Buffers: shared hit=2
                          ->  Materialize  (cost=0.29..8.31 rows=1 width=47) (actual time=0.000..0.000 rows=1.00 loops=242)
                                Storage: Memory  Maximum Storage: 17kB
                                Buffers: shared hit=3
                                ->  Index Scan using users_pkey on users ru  (cost=0.29..8.30 rows=1 width=47) (actual time=0.005..0.005 rows=1.00 loops=1)
                                      Index Cond: (id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                      Index Searches: 1
                                      Buffers: shared hit=3
                    ->  Hash  (cost=514.06..514.06 rows=22006 width=47) (actual time=4.035..4.035 rows=22006.00 loops=1)
                          Buckets: 32768  Batches: 1  Memory Usage: 1663kB
                          Buffers: shared hit=294
                          ->  Seq Scan on users u  (cost=0.00..514.06 rows=22006 width=47) (actual time=0.005..1.811 rows=22006.00 loops=1)
                                Buffers: shared hit=294
              ->  Hash  (cost=48.03..48.03 rows=2003 width=57) (actual time=0.427..0.427 rows=2003.00 loops=1)
                    Buckets: 2048  Batches: 1  Memory Usage: 204kB
                    Buffers: shared hit=28
                    ->  Seq Scan on driver_profiles dp  (cost=0.00..48.03 rows=2003 width=57) (actual time=0.009..0.187 rows=2003.00 loops=1)
                          Buffers: shared hit=28
Planning:
  Buffers: shared hit=32
Planning Time: 0.448 ms
Execution Time: 4.997 ms
```

### Driver history, page 1

```
Limit  (cost=819.21..819.26 rows=20 width=306) (actual time=0.487..0.491 rows=20.00 loops=1)
  Buffers: shared hit=426
  ->  Sort  (cost=819.21..819.39 rows=75 width=306) (actual time=0.487..0.489 rows=20.00 loops=1)
        Sort Key: r.requested_at DESC, r.id
        Sort Method: top-N heapsort  Memory: 43kB
        Buffers: shared hit=426
        ->  Nested Loop Left Join  (cost=5.73..817.21 rows=75 width=306) (actual time=0.043..0.441 rows=105.00 loops=1)
              Buffers: shared hit=426
              ->  Nested Loop Left Join  (cost=5.45..807.97 rows=75 width=265) (actual time=0.037..0.410 rows=105.00 loops=1)
                    Buffers: shared hit=423
                    ->  Nested Loop Left Join  (cost=5.16..798.73 rows=75 width=234) (actual time=0.030..0.379 rows=105.00 loops=1)
                          Buffers: shared hit=420
                          ->  Bitmap Heap Scan on rides r  (cost=4.88..275.85 rows=75 width=203) (actual time=0.024..0.147 rows=105.00 loops=1)
                                Recheck Cond: (driver_id = '82deb9bc-e0f5-42e6-845e-9e861940af91'::uuid)
                                Heap Blocks: exact=103
                                Buffers: shared hit=105
                                ->  Bitmap Index Scan on idx_rides_driver  (cost=0.00..4.86 rows=75 width=0) (actual time=0.009..0.009 rows=105.00 loops=1)
                                      Index Cond: (driver_id = '82deb9bc-e0f5-42e6-845e-9e861940af91'::uuid)
                                      Index Searches: 1
                                      Buffers: shared hit=2
                          ->  Index Scan using users_pkey on users ru  (cost=0.29..6.97 rows=1 width=47) (actual time=0.002..0.002 rows=1.00 loops=105)
                                Index Cond: (id = r.rider_id)
                                Index Searches: 105
                                Buffers: shared hit=315
                    ->  Materialize  (cost=0.29..8.31 rows=1 width=47) (actual time=0.000..0.000 rows=1.00 loops=105)
                          Storage: Memory  Maximum Storage: 17kB
                          Buffers: shared hit=3
                          ->  Index Scan using users_pkey on users u  (cost=0.29..8.30 rows=1 width=47) (actual time=0.004..0.004 rows=1.00 loops=1)
                                Index Cond: (id = '82deb9bc-e0f5-42e6-845e-9e861940af91'::uuid)
                                Index Searches: 1
                                Buffers: shared hit=3
              ->  Materialize  (cost=0.28..8.30 rows=1 width=57) (actual time=0.000..0.000 rows=1.00 loops=105)
                    Storage: Memory  Maximum Storage: 17kB
                    Buffers: shared hit=3
                    ->  Index Scan using driver_profiles_pkey on driver_profiles dp  (cost=0.28..8.29 rows=1 width=57) (actual time=0.004..0.004 rows=1.00 loops=1)
                          Index Cond: (user_id = '82deb9bc-e0f5-42e6-845e-9e861940af91'::uuid)
                          Index Searches: 1
                          Buffers: shared hit=3
Planning:
  Buffers: shared hit=16
Planning Time: 0.382 ms
Execution Time: 0.540 ms
```

### Driver weekly earnings (listCompletedThisWeek)

```
Sort  (cost=276.98..276.99 rows=1 width=204) (actual time=0.211..0.212 rows=1.00 loops=1)
  Sort Key: completed_at DESC
  Sort Method: quicksort  Memory: 25kB
  Buffers: shared hit=105
  ->  Bitmap Heap Scan on rides r  (cost=4.86..276.97 rows=1 width=204) (actual time=0.041..0.206 rows=1.00 loops=1)
        Recheck Cond: (driver_id = '82deb9bc-e0f5-42e6-845e-9e861940af91'::uuid)
        Filter: ((status = 'completed'::text) AND (completed_at >= (date_trunc('week'::text, (now() AT TIME ZONE 'Asia/Kolkata'::text)) AT TIME ZONE 'Asia/Kolkata'::text)))
        Rows Removed by Filter: 104
        Heap Blocks: exact=103
        Buffers: shared hit=105
        ->  Bitmap Index Scan on idx_rides_driver  (cost=0.00..4.86 rows=75 width=0) (actual time=0.016..0.016 rows=105.00 loops=1)
              Index Cond: (driver_id = '82deb9bc-e0f5-42e6-845e-9e861940af91'::uuid)
              Index Searches: 1
              Buffers: shared hit=2
Planning Time: 0.149 ms
Execution Time: 0.240 ms
```

### Driver average rating (summaryForDriver)

```
Aggregate  (cost=18.12..18.13 rows=1 width=12) (actual time=0.023..0.024 rows=1.00 loops=1)
  Buffers: shared hit=9
  ->  Nested Loop  (cost=0.42..18.11 rows=1 width=4) (actual time=0.021..0.021 rows=0.00 loops=1)
        Buffers: shared hit=9
        ->  Seq Scan on ratings rt  (cost=0.00..1.02 rows=2 width=20) (actual time=0.006..0.006 rows=2.00 loops=1)
              Buffers: shared hit=1
        ->  Index Scan using rides_pkey on rides r  (cost=0.42..8.44 rows=1 width=16) (actual time=0.006..0.006 rows=0.00 loops=2)
              Index Cond: (id = rt.ride_id)
              Filter: (driver_id = '82deb9bc-e0f5-42e6-845e-9e861940af91'::uuid)
              Rows Removed by Filter: 1
              Index Searches: 2
              Buffers: shared hit=8
Planning:
  Buffers: shared hit=13
Planning Time: 0.177 ms
Execution Time: 0.053 ms
```

### Rider has an active ride? (findActiveByRider)

```
Limit  (cost=0.28..8.29 rows=1 width=16) (actual time=0.017..0.017 rows=1.00 loops=1)
  Buffers: shared hit=3
  ->  Index Scan using ux_rides_rider_active on rides  (cost=0.28..8.29 rows=1 width=16) (actual time=0.016..0.016 rows=1.00 loops=1)
        Index Cond: (rider_id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
        Index Searches: 1
        Buffers: shared hit=3
Planning Time: 0.133 ms
Execution Time: 0.034 ms
```
