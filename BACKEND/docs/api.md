# Hopz API contract

Base path: `/api`. JSON in, JSON out.

```
success: { "success": true,  "data": ... }
failure: { "success": false, "error": "message" }
```

Auth = header `Authorization: Bearer <token>` (token from signup/login).

Common errors: `400` invalid input · `401` missing/invalid token · `403` wrong role · `404` unknown id or not your ride · `409` wrong status for the action · `423` locked · `429` rate limited · `500` server error · `501` not implemented yet.

Ride object (fields shown by `toRide`; `start_pin` appears only for the rider of that ride):

```json
{
  "id": "uuid", "rider_id": "uuid", "driver_id": "uuid|null",
  "pickup": { "text": "...", "lat": 28.61, "lng": 77.2 },
  "drop":   { "text": "...", "lat": 28.55, "lng": 77.25 },
  "vehicle_type": "mini", "distance_km": 8.42, "fare": 168,
  "status": "requested", "cancelled_by": null,
  "requested_at": "...", "accepted_at": null, "arrived_at": null,
  "started_at": null, "completed_at": null, "cancelled_at": null,
  "driver": null,
  "start_pin": "4821"
}
```

`driver` once accepted: `{ id, name, phone, vehicle_type, vehicle_model, plate, location }`. `location` is `{ lat, lng }` (the driver's latest GPS) only for the ride's rider while the ride is accepted, arrived or started; otherwise `null`. `rider` (`{ name, phone }`) is shown only to the ride's own driver, so they can call the rider.

Status moves: `requested → accepted | cancelled`, `accepted → arrived | cancelled`, `arrived → started | cancelled`, `started → completed`.

---

## 1. GET /health
- Auth: public
- Success `200`: `{ "success": true, "data": { "status": "ok" } }`
- Errors: none

## 2. GET /health/db
- Auth: public
- Runs `SELECT 1`.
- Success `200`: `{ "success": true, "data": { "status": "ok", "db": "up" } }`
- Errors: `503` database unreachable

## 3. POST /auth/signup
- Auth: public, rate limited (20 per 15 min per IP)
- Body:
  ```json
  { "name": "Asha", "email": "asha@example.com", "password": "min 8 chars", "role": "rider|driver", "phone": "optional, normalized to +91... (see below)",
    "vehicle_type": "auto|mini|sedan (required for drivers)", "vehicle_model": "optional", "plate": "optional" }
  ```
- Success `201`: `{ "user": { id, name, email, phone, role, created_at, driver_profile? }, "token": "..." }`
- Errors: `400` invalid input (incl. driver without `vehicle_type`) · `409` email already registered · `429`
- Email is stored lower-cased.
- Phone is stored as `+<country><digits>`. Login and signup accept just the 10 digits: `98765 43210`, `+91 98765-43210` and `919876543210` all become `+919876543210`. Invalid numbers are `400`. A number is unique across all accounts; a taken number is `409`. A database trigger adds `+91` to a bare 10-digit number typed straight into the table, and a check rejects anything that still is not `+<digits>`.

## 4. POST /auth/login
- Auth: public, rate limited
- Body: `{ "identifier": "email or phone number", "password": "..." }` (`email` is still accepted in place of `identifier`)
- Success `200`: `{ "user": {...}, "token": "..." }`
- Errors: `400` invalid input · `401` "Invalid email/phone or password" (identical for an unknown identifier and a wrong password) · `429`

## 5. GET /users/me
- Auth: any
- Success `200`: the user `{ id, name, email, phone, role, created_at }`, plus `driver_profile { vehicle_type, vehicle_model, plate, is_online, lat, lng, location_updated_at, rating { average, count } }` for drivers. `rating.average` is the mean stars (1 decimal) over the driver's rated rides, `null` until the first rating.
- Errors: `401` · `404` account no longer exists

## 6. POST /rides
- Auth: rider
- Body: `{ "pickup": {text, lat, lng}, "drop": {text, lat, lng}, "vehicle_type": "auto|mini|sedan" }`
- Server computes `distance_km` (haversine) and `fare`; the client never sends them.
- Success `201`: the ride, status `requested`, with `start_pin` null until accepted.
- Errors: `400` · `403` not a rider · `409` rider already has an active ride

## 7. GET /rides/:id
- Auth: rider or driver of that ride
- Success `200`: the ride with `driver` details once accepted; `start_pin` only for the rider.
- Errors: `400` bad id · `404` unknown id or not your ride

## 8. GET /rides
- Auth: any
- Query: `status?` (one of the six statuses), `limit?` (1–100, default 20), `offset?` (default 0)
- Success `200`: array of the caller's own rides, newest first.
- Errors: `400`

## 9. POST /rides/:id/cancel
- Auth: rider or driver of the ride
- Allowed from `requested`, `accepted`, `arrived`. Saves `cancelled_by`.
- Success `200`: the ride, status `cancelled`.
- Errors: `404` unknown or not your ride · `409` ride already started, completed or cancelled

## 10. POST /rides/:id/accept
- Auth: driver
- Driver must be online with no active ride; ride must be `requested`. First driver wins via one atomic `UPDATE ... WHERE status = 'requested'`. Creates the 4-digit PIN.
- Success `200`: the ride, status `accepted`, with `driver` filled in (the driver does not see the PIN; the rider reads it from `GET /rides/:id`).
- Errors: `403` not a driver · `404` unknown id · `409` driver offline, driver has an active ride, ride needs a different `vehicle_type`, or ride is no longer `requested` (another driver won)

## 11. POST /rides/:id/decline
- Auth: driver
- Writes a `declined` ride_event; the ride stays open for others and disappears from this driver's requests.
- Success `200`: `{ "declined": true }`
- Errors: `403` · `404` · `409` ride is not `requested`

## 12. POST /rides/:id/arrived
- Auth: driver (the ride's driver)
- `accepted → arrived`
- Success `200`: the ride, status `arrived`.
- Errors: `403` · `404` not your ride · `409` wrong status

## 13. POST /rides/:id/start
- Auth: driver (the ride's driver)
- Body: `{ "pin": "4821" }` (4 digits)
- `arrived → started` only if the PIN matches. A wrong PIN adds 1 to `pin_attempts`; at `PIN_MAX_ATTEMPTS` (default 5) the start is locked.
- Success `200`: the ride, status `started`.
- Errors: `400` malformed PIN, or wrong PIN (the message says how many attempts are left) · `403` · `404` not your ride · `409` ride is not `arrived` · `423` locked after `PIN_MAX_ATTEMPTS` wrong tries (even the right PIN is refused after that)

## 14. POST /rides/:id/complete
- Auth: driver (the ride's driver)
- `started → completed`
- Success `200`: the ride, status `completed`.
- Errors: `403` · `404` · `409` wrong status

## 15. POST /rides/:id/rating
- Auth: rider of the ride
- Body: `{ "stars": 1-5, "tip": 0 (optional, whole rupees, not negative), "comment": "optional, max 500" }`
- Only once, only after `completed`.
- Success `201`: `{ ride_id, stars, tip, comment, created_at }`
- Errors: `400` · `403` not a rider · `404` unknown id or not your ride · `409` ride not completed or already rated
- There is no stored driver average yet; ratings are saved per ride.

## 16. POST /drivers/status
- Auth: driver
- Body: `{ "is_online": true }`
- Cannot go offline during an active ride.
- Success `200`: the driver profile.
- Errors: `400` · `403` · `409` active ride

## 17. GET /drivers/requests
- Auth: driver
- `requested` rides within `NEARBY_RADIUS_KM` of the driver's last location, matching their `vehicle_type`, excluding rides this driver declined. `[]` if offline.
- Success `200`: array of rides, nearest pickup first. Each has an extra `pickup_distance_km` and no `start_pin`. At most 50.
- Errors: `403`

## 18. POST /drivers/location
- Auth: driver
- Body: `{ "lat": 28.61, "lng": 77.2 }`
- Success `200`: the driver profile with the new location.
- Errors: `400` · `403`

## 19. GET /drivers/earnings
- Auth: driver
- "Today" and "this week" (Monday start) are counted in Asia/Kolkata time.
- Success `200`: `{ "today": 168, "week": 504, "rides": [ this week's completed rides, newest first ] }` (whole rupees).
- Errors: `403`

## 20. POST /push-tokens
- Auth: any
- Body: `{ "token": "ExponentPushToken[...]", "platform": "ios|android" }`
- Saves or updates; a token already stored moves to the caller.
- Success `200`: `{ "token": "...", "platform": "..." }`
- Errors: `400`
