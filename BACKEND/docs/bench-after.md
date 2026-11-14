# Query benchmark: after

Test database, about 150,000 rides, 22,000 users. Median of 5 runs after a warm-up.

| Query | Median ms | Buffers | Rows | Plan steps |
| --- | ---: | ---: | ---: | --- |
| Driver polls open requests (listRequestedInBox) | 0.64 | 122 | 27 | Limit > Sort > Nested Loop > Hash Join > Nested Loop > Nested Loop > Bitmap Heap Scan on rides > Bitmap Index Scan using idx_rides_open > Index Scan using users_pkey on users > Index Scan using users_pkey on users > Hash > Seq Scan on driver_profiles > Materialize > Index Only Scan using idx_ride_events_decline on ride_events |
| Expire stale requests (cancelStaleRequested, rolled back) | 4.14 | 4665 | 300 | ModifyTable on rides > Bitmap Heap Scan on rides > Bitmap Index Scan using idx_rides_open |
| Rider history, page 1 (OFFSET 0) | 0.22 | 146 | 20 | Limit > Incremental Sort > Nested Loop > Nested Loop > Nested Loop > Index Scan using idx_rides_rider_hist on rides > Materialize > Index Scan using users_pkey on users > Memoize > Index Scan using users_pkey on users > Memoize > Index Scan using driver_profiles_pkey on driver_profiles |
| Rider history, deep page (OFFSET 800) | 5.91 | 366 | 20 | Limit > Sort > Hash Join > Hash Join > Nested Loop > Bitmap Heap Scan on rides > Bitmap Index Scan using idx_rides_rider_hist > Materialize > Index Scan using users_pkey on users > Hash > Seq Scan on users > Hash > Seq Scan on driver_profiles |
| Rider history, same page by keyset cursor | 0.19 | 145 | 20 | Limit > Nested Loop > Nested Loop > Nested Loop > Index Scan using idx_rides_rider_hist on rides > Materialize > Index Scan using users_pkey on users > Memoize > Index Scan using users_pkey on users > Index Scan using driver_profiles_pkey on driver_profiles |
| Driver history, page 1 | 0.18 | 93 | 20 | Limit > Incremental Sort > Nested Loop > Nested Loop > Nested Loop > Index Scan using idx_rides_driver_hist on rides > Index Scan using users_pkey on users > Materialize > Index Scan using users_pkey on users > Materialize > Index Scan using driver_profiles_pkey on driver_profiles |
| Driver weekly earnings (listCompletedThisWeek) | 0.05 | 4 | 1 | Index Scan using idx_rides_driver_done on rides |
| Driver average rating (summaryForDriver) | 0.08 | 11 | 1 | Aggregate > Nested Loop > Seq Scan on ratings > Index Only Scan using idx_rides_driver_hist on rides |
| Rider has an active ride? (findActiveByRider) | 0.04 | 3 | 1 | Limit > Index Scan using ux_rides_rider_active on rides |

## Full plans

### Driver polls open requests (listRequestedInBox)

```
Limit  (cost=862.68..862.74 rows=26 width=306) (actual time=0.573..0.577 rows=27.00 loops=1)
  Buffers: shared hit=122
  ->  Sort  (cost=862.68..862.74 rows=26 width=306) (actual time=0.572..0.575 rows=27.00 loops=1)
        Sort Key: r.requested_at
        Sort Method: quicksort  Memory: 31kB
        Buffers: shared hit=122
        ->  Nested Loop Anti Join  (cost=82.97..862.07 rows=26 width=306) (actual time=0.462..0.559 rows=27.00 loops=1)
              Join Filter: (e.ride_id = r.id)
              Buffers: shared hit=122
              ->  Hash Left Join  (cost=82.69..853.38 rows=26 width=306) (actual time=0.456..0.546 rows=27.00 loops=1)
                    Hash Cond: (r.driver_id = dp.user_id)
                    Buffers: shared hit=119
                    ->  Nested Loop Left Join  (cost=9.63..780.25 rows=26 width=265) (actual time=0.026..0.111 rows=27.00 loops=1)
                          Buffers: shared hit=91
                          ->  Nested Loop Left Join  (cost=9.34..576.32 rows=26 width=234) (actual time=0.025..0.101 rows=27.00 loops=1)
                                Buffers: shared hit=91
                                ->  Bitmap Heap Scan on rides r  (cost=9.05..372.39 rows=26 width=203) (actual time=0.019..0.041 rows=27.00 loops=1)
                                      Recheck Cond: ((vehicle_type = 'mini'::text) AND (status = 'requested'::text))
                                      Filter: ((pickup_lat >= '28.5'::double precision) AND (pickup_lat <= '28.7'::double precision) AND (pickup_lng >= '77.1'::double precision) AND (pickup_lng <= '77.3'::double precision))
                                      Rows Removed by Filter: 70
                                      Heap Blocks: exact=8
                                      Buffers: shared hit=10
                                      ->  Bitmap Index Scan on idx_rides_open  (cost=0.00..9.05 rows=103 width=0) (actual time=0.010..0.010 rows=97.00 loops=1)
                                            Index Cond: (vehicle_type = 'mini'::text)
                                            Index Searches: 1
                                            Buffers: shared hit=2
                                ->  Index Scan using users_pkey on users ru  (cost=0.29..7.84 rows=1 width=47) (actual time=0.002..0.002 rows=1.00 loops=27)
                                      Index Cond: (id = r.rider_id)
                                      Index Searches: 27
                                      Buffers: shared hit=81
                          ->  Index Scan using users_pkey on users u  (cost=0.29..7.84 rows=1 width=47) (actual time=0.000..0.000 rows=0.00 loops=27)
                                Index Cond: (id = r.driver_id)
                                Index Searches: 0
                    ->  Hash  (cost=48.03..48.03 rows=2003 width=57) (actual time=0.427..0.427 rows=2003.00 loops=1)
                          Buckets: 2048  Batches: 1  Memory Usage: 204kB
                          Buffers: shared hit=28
                          ->  Seq Scan on driver_profiles dp  (cost=0.00..48.03 rows=2003 width=57) (actual time=0.004..0.188 rows=2003.00 loops=1)
                                Buffers: shared hit=28
              ->  Materialize  (cost=0.27..8.30 rows=1 width=16) (actual time=0.000..0.000 rows=0.00 loops=27)
                    Storage: Memory  Maximum Storage: 17kB
                    Buffers: shared hit=3
                    ->  Index Only Scan using idx_ride_events_decline on ride_events e  (cost=0.27..8.29 rows=1 width=16) (actual time=0.004..0.005 rows=0.00 loops=1)
                          Index Cond: (actor_id = '939d4655-f197-4f0b-aca3-1eb2ab7b4f75'::uuid)
                          Heap Fetches: 0
                          Index Searches: 1
                          Buffers: shared hit=3
Planning:
  Buffers: shared hit=65
Planning Time: 1.027 ms
Execution Time: 0.636 ms
```

### Expire stale requests (cancelStaleRequested, rolled back)

```
Update on rides  (cost=18.95..986.00 rows=309 width=78) (actual time=0.219..4.968 rows=300.00 loops=1)
  Buffers: shared hit=4751 dirtied=9 written=9
  ->  Bitmap Heap Scan on rides  (cost=18.95..986.00 rows=309 width=78) (actual time=0.049..0.110 rows=300.00 loops=1)
        Recheck Cond: ((requested_at < (now() - '00:01:00'::interval)) AND (status = 'requested'::text))
        Heap Blocks: exact=8
        Buffers: shared hit=11
        ->  Bitmap Index Scan on idx_rides_open  (cost=0.00..18.88 rows=309 width=0) (actual time=0.034..0.034 rows=300.00 loops=1)
              Index Cond: (requested_at < (now() - '00:01:00'::interval))
              Index Searches: 1
              Buffers: shared hit=3
Planning Time: 0.125 ms
Execution Time: 5.021 ms
```

### Rider history, page 1 (OFFSET 0)

```
Limit  (cost=6.88..119.27 rows=20 width=306) (actual time=0.163..0.166 rows=20.00 loops=1)
  Buffers: shared hit=146
  ->  Incremental Sort  (cost=6.88..5710.50 rows=1015 width=306) (actual time=0.162..0.164 rows=20.00 loops=1)
        Sort Key: r.requested_at DESC, r.id
        Presorted Key: r.requested_at
        Full-sort Groups: 1  Sort Method: quicksort  Average Memory: 34kB  Peak Memory: 34kB
        Buffers: shared hit=146
        ->  Nested Loop Left Join  (cost=1.29..5664.83 rows=1015 width=306) (actual time=0.024..0.148 rows=21.00 loops=1)
              Buffers: shared hit=146
              ->  Nested Loop Left Join  (cost=1.00..5281.45 rows=1015 width=265) (actual time=0.021..0.102 rows=21.00 loops=1)
                    Buffers: shared hit=86
                    ->  Nested Loop Left Join  (cost=0.71..3707.17 rows=1015 width=234) (actual time=0.018..0.044 rows=21.00 loops=1)
                          Buffers: shared hit=26
                          ->  Index Scan using idx_rides_rider_hist on rides r  (cost=0.42..3686.18 rows=1015 width=203) (actual time=0.011..0.032 rows=21.00 loops=1)
                                Index Cond: (rider_id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                Index Searches: 1
                                Buffers: shared hit=23
                          ->  Materialize  (cost=0.29..8.31 rows=1 width=47) (actual time=0.000..0.000 rows=1.00 loops=21)
                                Storage: Memory  Maximum Storage: 17kB
                                Buffers: shared hit=3
                                ->  Index Scan using users_pkey on users ru  (cost=0.29..8.30 rows=1 width=47) (actual time=0.003..0.003 rows=1.00 loops=1)
                                      Index Cond: (id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                      Index Searches: 1
                                      Buffers: shared hit=3
                    ->  Memoize  (cost=0.30..1.95 rows=1 width=47) (actual time=0.003..0.003 rows=0.95 loops=21)
                          Cache Key: r.driver_id
                          Cache Mode: logical
                          Hits: 0  Misses: 21  Evictions: 0  Overflows: 0  Memory Usage: 3kB
                          Buffers: shared hit=60
                          ->  Index Scan using users_pkey on users u  (cost=0.29..1.94 rows=1 width=47) (actual time=0.002..0.002 rows=0.95 loops=21)
                                Index Cond: (id = r.driver_id)
                                Index Searches: 20
                                Buffers: shared hit=60
              ->  Memoize  (cost=0.29..0.46 rows=1 width=57) (actual time=0.002..0.002 rows=0.95 loops=21)
                    Cache Key: r.driver_id
                    Cache Mode: logical
                    Hits: 0  Misses: 21  Evictions: 0  Overflows: 0  Memory Usage: 4kB
                    Buffers: shared hit=60
                    ->  Index Scan using driver_profiles_pkey on driver_profiles dp  (cost=0.28..0.45 rows=1 width=57) (actual time=0.001..0.001 rows=0.95 loops=21)
                          Index Cond: (user_id = r.driver_id)
                          Index Searches: 20
                          Buffers: shared hit=60
Planning:
  Buffers: shared hit=36
Planning Time: 0.473 ms
Execution Time: 0.215 ms
```

### Rider history, deep page (OFFSET 800)

```
Limit  (cost=3380.73..3380.78 rows=20 width=306) (actual time=6.282..6.288 rows=20.00 loops=1)
  Buffers: shared hit=366
  ->  Sort  (cost=3378.73..3381.27 rows=1015 width=306) (actual time=6.195..6.254 rows=820.00 loops=1)
        Sort Key: r.requested_at DESC, r.id
        Sort Method: quicksort  Memory: 578kB
        Buffers: shared hit=366
        ->  Hash Left Join  (cost=902.78..3328.05 rows=1015 width=306) (actual time=4.879..5.796 rows=1043.00 loops=1)
              Hash Cond: (r.driver_id = dp.user_id)
              Buffers: shared hit=366
              ->  Hash Left Join  (cost=829.71..3252.31 rows=1015 width=265) (actual time=4.433..5.109 rows=1043.00 loops=1)
                    Hash Cond: (r.driver_id = u.id)
                    Buffers: shared hit=338
                    ->  Nested Loop Left Join  (cost=40.57..2460.51 rows=1015 width=234) (actual time=0.059..0.498 rows=1043.00 loops=1)
                          Buffers: shared hit=44
                          ->  Bitmap Heap Scan on rides r  (cost=40.29..2439.51 rows=1015 width=203) (actual time=0.052..0.259 rows=1043.00 loops=1)
                                Recheck Cond: (rider_id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                Heap Blocks: exact=31
                                Buffers: shared hit=41
                                ->  Bitmap Index Scan on idx_rides_rider_hist  (cost=0.00..40.03 rows=1015 width=0) (actual time=0.039..0.039 rows=1043.00 loops=1)
                                      Index Cond: (rider_id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                      Index Searches: 1
                                      Buffers: shared hit=10
                          ->  Materialize  (cost=0.29..8.31 rows=1 width=47) (actual time=0.000..0.000 rows=1.00 loops=1043)
                                Storage: Memory  Maximum Storage: 17kB
                                Buffers: shared hit=3
                                ->  Index Scan using users_pkey on users ru  (cost=0.29..8.30 rows=1 width=47) (actual time=0.004..0.004 rows=1.00 loops=1)
                                      Index Cond: (id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                      Index Searches: 1
                                      Buffers: shared hit=3
                    ->  Hash  (cost=514.06..514.06 rows=22006 width=47) (actual time=4.363..4.364 rows=22006.00 loops=1)
                          Buckets: 32768  Batches: 1  Memory Usage: 1663kB
                          Buffers: shared hit=294
                          ->  Seq Scan on users u  (cost=0.00..514.06 rows=22006 width=47) (actual time=0.006..2.125 rows=22006.00 loops=1)
                                Buffers: shared hit=294
              ->  Hash  (cost=48.03..48.03 rows=2003 width=57) (actual time=0.443..0.443 rows=2003.00 loops=1)
                    Buckets: 2048  Batches: 1  Memory Usage: 204kB
                    Buffers: shared hit=28
                    ->  Seq Scan on driver_profiles dp  (cost=0.00..48.03 rows=2003 width=57) (actual time=0.010..0.187 rows=2003.00 loops=1)
                          Buffers: shared hit=28
Planning:
  Buffers: shared hit=36
Planning Time: 0.475 ms
Execution Time: 6.350 ms
```

### Rider history, same page by keyset cursor

```
Limit  (cost=1.28..203.39 rows=20 width=306) (actual time=0.031..0.165 rows=20.00 loops=1)
  Buffers: shared hit=145
  ->  Nested Loop Left Join  (cost=1.28..2214.38 rows=219 width=306) (actual time=0.031..0.163 rows=20.00 loops=1)
        Buffers: shared hit=145
        ->  Nested Loop Left Join  (cost=1.00..1993.77 rows=219 width=265) (actual time=0.027..0.123 rows=20.00 loops=1)
              Buffers: shared hit=85
              ->  Nested Loop Left Join  (cost=0.71..879.84 rows=219 width=234) (actual time=0.021..0.044 rows=20.00 loops=1)
                    Buffers: shared hit=25
                    ->  Index Scan using idx_rides_rider_hist on rides r  (cost=0.42..868.80 rows=219 width=203) (actual time=0.014..0.032 rows=20.00 loops=1)
                          Index Cond: ((rider_id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid) AND (ROW(requested_at, id) < ROW('2026-01-31 09:48:43.789+00'::timestamp with time zone, 'c2a8c278-0f5f-4ba1-9a82-f4ab3d7b2d82'::uuid)))
                          Index Searches: 1
                          Buffers: shared hit=22
                    ->  Materialize  (cost=0.29..8.31 rows=1 width=47) (actual time=0.000..0.000 rows=1.00 loops=20)
                          Storage: Memory  Maximum Storage: 17kB
                          Buffers: shared hit=3
                          ->  Index Scan using users_pkey on users ru  (cost=0.29..8.30 rows=1 width=47) (actual time=0.004..0.004 rows=1.00 loops=1)
                                Index Cond: (id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
                                Index Searches: 1
                                Buffers: shared hit=3
              ->  Memoize  (cost=0.30..5.34 rows=1 width=47) (actual time=0.004..0.004 rows=1.00 loops=20)
                    Cache Key: r.driver_id
                    Cache Mode: logical
                    Hits: 0  Misses: 20  Evictions: 0  Overflows: 0  Memory Usage: 3kB
                    Buffers: shared hit=60
                    ->  Index Scan using users_pkey on users u  (cost=0.29..5.33 rows=1 width=47) (actual time=0.002..0.002 rows=1.00 loops=20)
                          Index Cond: (id = r.driver_id)
                          Index Searches: 20
                          Buffers: shared hit=60
        ->  Index Scan using driver_profiles_pkey on driver_profiles dp  (cost=0.28..1.01 rows=1 width=57) (actual time=0.002..0.002 rows=1.00 loops=20)
              Index Cond: (user_id = r.driver_id)
              Index Searches: 20
              Buffers: shared hit=60
Planning:
  Buffers: shared hit=36
Planning Time: 0.449 ms
Execution Time: 0.212 ms
```

### Driver history, page 1

```
Limit  (cost=12.56..236.00 rows=20 width=306) (actual time=0.137..0.140 rows=20.00 loops=1)
  Buffers: shared hit=93
  ->  Incremental Sort  (cost=12.56..850.45 rows=75 width=306) (actual time=0.136..0.137 rows=20.00 loops=1)
        Sort Key: r.requested_at DESC, r.id
        Presorted Key: r.requested_at
        Full-sort Groups: 1  Sort Method: quicksort  Average Memory: 35kB  Peak Memory: 35kB
        Buffers: shared hit=93
        ->  Nested Loop Left Join  (cost=1.27..847.08 rows=75 width=306) (actual time=0.029..0.120 rows=21.00 loops=1)
              Buffers: shared hit=93
              ->  Nested Loop Left Join  (cost=0.99..837.84 rows=75 width=265) (actual time=0.023..0.109 rows=21.00 loops=1)
                    Buffers: shared hit=90
                    ->  Nested Loop Left Join  (cost=0.71..828.60 rows=75 width=234) (actual time=0.017..0.098 rows=21.00 loops=1)
                          Buffers: shared hit=87
                          ->  Index Scan using idx_rides_driver_hist on rides r  (cost=0.42..305.72 rows=75 width=203) (actual time=0.012..0.043 rows=21.00 loops=1)
                                Index Cond: (driver_id = '82deb9bc-e0f5-42e6-845e-9e861940af91'::uuid)
                                Index Searches: 1
                                Buffers: shared hit=24
                          ->  Index Scan using users_pkey on users ru  (cost=0.29..6.97 rows=1 width=47) (actual time=0.002..0.002 rows=1.00 loops=21)
                                Index Cond: (id = r.rider_id)
                                Index Searches: 21
                                Buffers: shared hit=63
                    ->  Materialize  (cost=0.29..8.31 rows=1 width=47) (actual time=0.000..0.000 rows=1.00 loops=21)
                          Storage: Memory  Maximum Storage: 17kB
                          Buffers: shared hit=3
                          ->  Index Scan using users_pkey on users u  (cost=0.29..8.30 rows=1 width=47) (actual time=0.003..0.003 rows=1.00 loops=1)
                                Index Cond: (id = '82deb9bc-e0f5-42e6-845e-9e861940af91'::uuid)
                                Index Searches: 1
                                Buffers: shared hit=3
              ->  Materialize  (cost=0.28..8.30 rows=1 width=57) (actual time=0.000..0.000 rows=1.00 loops=21)
                    Storage: Memory  Maximum Storage: 17kB
                    Buffers: shared hit=3
                    ->  Index Scan using driver_profiles_pkey on driver_profiles dp  (cost=0.28..8.29 rows=1 width=57) (actual time=0.005..0.005 rows=1.00 loops=1)
                          Index Cond: (user_id = '82deb9bc-e0f5-42e6-845e-9e861940af91'::uuid)
                          Index Searches: 1
                          Buffers: shared hit=3
Planning:
  Buffers: shared hit=18
Planning Time: 0.373 ms
Execution Time: 0.187 ms
```

### Driver weekly earnings (listCompletedThisWeek)

```
Index Scan using idx_rides_driver_done on rides r  (cost=0.43..8.46 rows=1 width=204) (actual time=0.021..0.022 rows=1.00 loops=1)
  Index Cond: ((driver_id = '82deb9bc-e0f5-42e6-845e-9e861940af91'::uuid) AND (completed_at >= (date_trunc('week'::text, (now() AT TIME ZONE 'Asia/Kolkata'::text)) AT TIME ZONE 'Asia/Kolkata'::text)))
  Index Searches: 1
  Buffers: shared hit=4
Planning Time: 0.146 ms
Execution Time: 0.045 ms
```

### Driver average rating (summaryForDriver)

```
Aggregate  (cost=15.57..15.58 rows=1 width=12) (actual time=0.051..0.051 rows=1.00 loops=1)
  Buffers: shared hit=11
  ->  Nested Loop  (cost=0.42..15.56 rows=1 width=4) (actual time=0.048..0.048 rows=0.00 loops=1)
        Buffers: shared hit=11
        ->  Seq Scan on ratings rt  (cost=0.00..1.02 rows=2 width=20) (actual time=0.005..0.006 rows=2.00 loops=1)
              Buffers: shared hit=1
        ->  Index Only Scan using idx_rides_driver_hist on rides r  (cost=0.42..7.18 rows=1 width=16) (actual time=0.020..0.020 rows=0.00 loops=2)
              Index Cond: ((driver_id = '82deb9bc-e0f5-42e6-845e-9e861940af91'::uuid) AND (id = rt.ride_id))
              Heap Fetches: 0
              Index Searches: 2
              Buffers: shared hit=10
Planning:
  Buffers: shared hit=13
Planning Time: 0.193 ms
Execution Time: 0.081 ms
```

### Rider has an active ride? (findActiveByRider)

```
Limit  (cost=0.28..8.29 rows=1 width=16) (actual time=0.017..0.017 rows=1.00 loops=1)
  Buffers: shared hit=3
  ->  Index Scan using ux_rides_rider_active on rides  (cost=0.28..8.29 rows=1 width=16) (actual time=0.016..0.016 rows=1.00 loops=1)
        Index Cond: (rider_id = '99a0348b-9650-46b8-b956-c86536a3f96a'::uuid)
        Index Searches: 1
        Buffers: shared hit=3
Planning Time: 0.138 ms
Execution Time: 0.034 ms
```
