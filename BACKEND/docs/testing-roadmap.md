# Hopz API testing roadmap

Goal: prove all 20 endpoints in [api.md](api.md) work, in the order a real ride happens. Test each endpoint's happy path first, then its failure cases.

## 0. Setup (once)

1. `npm run dev` in `BACKEND/PROJECT-HOPZ` (API on `http://localhost:3000/api`).
2. Create three accounts through signup (#3). Email domain `@hopz-test.local` is the one the automated tests clean up, so use it here too:
   - `rider1@hopz-test.local` (rider)
   - `driver1@hopz-test.local` (driver, `vehicle_type: mini`)
   - `driver2@hopz-test.local` (driver, `vehicle_type: auto`, for wrong-vehicle and race tests)
   - Or run `npm run seed` for `rider@hopz.test`, `driver1@hopz.test`, `driver2@hopz.test` (password `password123`).
3. Use Postman or Insomnia, with variables `base`, `riderToken`, `driver1Token`, `driver2Token`, `rideId`. Save each token from the login response.
4. Send `Authorization: Bearer <token>` on everything except #1-#4.

Every response should have the envelope `{ success, data }` or `{ success: false, error }`. Check that on every call.

## Phase 1: Foundation (#1, #2)

| # | Call | Expect |
|---|------|--------|
| 1 | `GET /health` | 200 `{status:"ok"}`, no token needed |
| 2 | `GET /health/db` | 200 `db:"up"`. Stop Neon or break `DATABASE_URL` to also see 503 |
| - | `GET /nope` | 404 in the envelope |
| - | POST with broken JSON | 400 "Invalid JSON body" |

## Phase 2: Accounts (#3, #4, #5)

| # | Case | Expect |
|---|------|--------|
| 3 | Rider signup | 201, user + token, **no password hash** anywhere |
| 3 | Driver signup with `vehicle_type` | 201, `driver_profile` present |
| 3 | Driver signup without `vehicle_type` | 400 |
| 3 | Password under 8 chars / bad role / bad email | 400 |
| 3 | Same email again, different case (`ASHA@...`) | 409 (email is stored lower-case) |
| 3 | 21 signups from one IP in 15 min | 429 |
| 4 | Correct login | 200, token |
| 4 | Wrong password vs. unknown email | 401, **identical message** |
| 4 | Missing fields | 400 |
| 5 | `GET /users/me` as rider | user, no driver_profile |
| 5 | `GET /users/me` as driver | includes `driver_profile` |
| 5 | No token / garbage token / expired token | 401 |

## Phase 3: Driver readiness (#16, #18)

Drivers must be online and have a location before they can see rides.

| # | Case | Expect |
|---|------|--------|
| 18 | `POST /drivers/location {lat:28.61,lng:77.20}` as driver1 | 200, profile with new location |
| 18 | Missing lng, lat 999 | 400 |
| 18 | As rider | 403 |
| 16 | `POST /drivers/status {is_online:true}` | 200, `is_online:true` |
| 16 | `{is_online:"yes"}` | 400 |
| 16 | As rider | 403 |

Repeat both for driver2 at about the same location. Go offline again later (Phase 8).

## Phase 4: Requesting a ride (#6, #7, #8)

| # | Case | Expect |
|---|------|--------|
| 6 | Rider books pickup (28.61,77.20) to drop (28.55,77.25), `mini` | 201, status `requested`, server-computed `distance_km` and `fare`, `start_pin: null` |
| 6 | Client sends its own `fare` | ignored; server value used |
| 6 | Second request while one is active | 409 |
| 6 | Missing drop / bad `vehicle_type` / lat out of range | 400 |
| 6 | As driver | 403 |
| 7 | `GET /rides/:id` as rider | the ride |
| 7 | As an unrelated user | 404 |
| 7 | Malformed id (`/rides/abc`) | 400 |
| 8 | `GET /rides` | own rides only, newest first |
| 8 | `?status=requested`, `?limit=1&offset=1`, `?status=bogus` | filtered, paged, 400 |

Save the new ride's `id` as `rideId`.

## Phase 5: Driver sees and picks the ride (#17, #11, #10)

| # | Case | Expect |
|---|------|--------|
| 17 | `GET /drivers/requests` as driver1 (online, mini, nearby) | the ride, with `pickup_distance_km`, **no `start_pin`** |
| 17 | Same as driver2 (auto) | does not list a mini ride |
| 17 | Driver offline | `[]` |
| 17 | Driver far away (>5 km, change location) | `[]` |
| 11 | driver1 declines | 200 `{declined:true}`; ride gone from driver1's list, still open for others |
| 11 | Decline a ride that is no longer `requested` | 409 |
| 10 | driver2 (auto) accepts the mini ride | 409 wrong vehicle |
| 10 | Offline driver accepts | 409 |
| 10 | Rider accepts | 403 |
| 10 | Unknown ride id | 404 |
| 10 | **Race test:** create another ride, fire accept from two drivers at once (two Postman tabs, or `Promise.all`) | exactly one 200, one 409 |
| 10 | Driver accepts successfully | 200, status `accepted`, `driver` filled in, **no PIN in the driver's response** |
| 10 | Accept the same ride again | 409 |

After accepting, `GET /rides/:id` as the rider shows the 4-digit `start_pin` and the driver's name, phone, vehicle and plate. As the driver it must not show the PIN.

## Phase 6: The trip (#12, #13, #14)

| # | Case | Expect |
|---|------|--------|
| 14 | Complete straight away | 409 (steps can't be skipped) |
| 13 | Start before arrived | 409 |
| 12 | Another driver calls arrived | 404 |
| 12 | Rider calls arrived | 403 |
| 12 | Ride's driver calls arrived | 200, `arrived` |
| 13 | PIN `12ab` / 3 digits | 400 |
| 13 | Wrong PIN | 400, message says attempts left |
| 13 | Correct PIN (read from the rider's `GET /rides/:id`) | 200, `started` |
| 14 | Complete | 200, `completed`, `completed_at` set |
| 13 | **Lockout:** on a fresh ride, send 5 wrong PINs, then the right one | 5th wrong gives 423; right PIN still 423 |

## Phase 7: Cancelling (#9)

Run on fresh rides, one per case:

| Case | Expect |
|------|--------|
| Rider cancels `requested` ride | 200, `cancelled_by: rider` |
| Driver cancels `accepted` ride | 200, `cancelled_by: driver` |
| Cancel after `started` | 409 |
| Cancel a completed or already-cancelled ride | 409 |
| Stranger cancels | 404 |
| After cancelling, rider can book again | 201 |

## Phase 8: After the trip (#15, #19, #16 again)

| # | Case | Expect |
|---|------|--------|
| 15 | Rate before completion | 409 |
| 15 | Rider rates completed ride `{stars:5, tip:20, comment:"great"}` | 201 |
| 15 | Rate again | 409 |
| 15 | `stars:0`, `stars:6`, negative tip, comment over 500 chars | 400 |
| 15 | Driver tries to rate / someone else's ride | 403 / 404 |
| 19 | `GET /drivers/earnings` as driver1 | `today`, `week` equal sum of completed fares; `rides` lists them, newest first |
| 19 | As rider | 403 |
| 16 | Go offline during an active ride | 409; after the ride is done, 200 |

## Phase 9: Push tokens (#20)

| Case | Expect |
|------|--------|
| `POST /push-tokens {token:"ExponentPushToken[abc]", platform:"android"}` | 200 |
| Same token, `platform:"ios"` | 200, platform updated |
| Same token from another user | 200, token moves to that user |
| Missing token / bad platform | 400 |

## Phase 10: Cross-cutting checks

- **Auth on every protected endpoint:** call each of #5-#20 with no token and expect 401.
- **Role fences:** rider on every driver endpoint, driver on `POST /rides` and `/rating`: expect 403.
- **Ownership:** a third user on any `/rides/:id/*`: expect 404, never someone else's data.
- **Rate limit:** hammer `/auth/login` past the limit: expect 429.
- **Large body:** a JSON body over 100 KB: expect 413.
- **No secrets:** no response contains `password_hash`, and `start_pin` appears only for the ride's rider.

## Phase 11: Automated suite and the app

1. Run `npm test`. It covers most rows above ([auth.test.js](../tests/auth.test.js), [ride-flow.test.js](../tests/ride-flow.test.js)). Set `TEST_DATABASE_URL` to a separate Neon branch so tests never touch real data. All tests should pass before you move on.
2. Treat the manual run above as a check for anything the suite misses, such as real network and token expiry.
3. App check (Expo Go on your phone): signup, login, profile, Activity and Earnings should match what the API returns for the same account. The ride screens still use demo data until phase 2 of the app wiring.

## Tracking

Copy this into a sheet: one row per endpoint #1-#20, with columns for happy path, failure cases, date and notes. An endpoint is done when its happy path and every failure case above behave as stated.
