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

`driver` once accepted: `{ id, name, phone, vehicle_type, vehicle_model, plate }`.

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
  { "name": "Asha", "email": "asha@example.com", "password": "min 8 chars", "role": "rider|driver", "phone": "optional",
    "vehicle_type": "auto|mini|sedan (required for drivers)", "vehicle_model": "optional", "plate": "optional" }
  ```
- Success `201`: `{ "user": { id, name, email, phone, role, created_at, driver_profile? }, "token": "..." }`
- Errors: `400` invalid input (incl. driver without `vehicle_type`) · `409` email already registered · `429`
- Email is stored lower-cased.

## 4. POST /auth/login
- Auth: public, rate limited
- Body: `{ "email": "...", "password": "..." }`
- Success `200`: `{ "user": {...}, "token": "..." }`
- Errors: `400` invalid input · `401` "Invalid email or password" (identical for wrong email and wrong password) · `429`

## 5. GET /users/me
- Auth: any
- Success `200`: the user `{ id, name, email, phone, role, created_at }`, plus `driver_profile { vehicle_type, vehicle_model, plate, is_online, lat, lng, location_updated_at }` for drivers.
- Errors: `401` · `404` account no longer exists

## 6. POST /rides — Not implemented yet
- Auth: rider
- Body: `{ "pickup": {text, lat, lng}, "drop": {text, lat, lng}, "vehicle_type": "auto|mini|sedan" }`
- Server computes `distance_km` (haversine) and `fare`; the client never sends them.
- Success `201`: the ride, status `requested`, with `start_pin` null until accepted.
- Errors: `400` · `403` not a rider · `409` rider already has an active ride

## 7. GET /rides/:id — Not implemented yet
- Auth: rider or driver of that ride
- Success `200`: the ride with `driver` details once accepted; `start_pin` only for the rider.
- Errors: `400` bad id · `404` unknown id or not your ride

## 8. GET /rides — Not implemented yet
- Auth: any
- Query: `status?` (one of the six statuses), `limit?` (1–100, default 20), `offset?` (default 0)
- Success `200`: array of the caller's own rides, newest first.
- Errors: `400`

## 9. POST /rides/:id/cancel — Not implemented yet
- Auth: rider or driver of the ride
- Allowed from `requested`, `accepted`, `arrived`. Saves `cancelled_by`.
- Success `200`: the ride, status `cancelled`.
- Errors: `404` unknown or not your ride · `409` ride already started, completed or cancelled

## 10. POST /rides/:id/accept — Not implemented yet
- Auth: driver
- Driver must be online with no active ride; ride must be `requested`. First driver wins via one atomic `UPDATE ... WHERE status = 'requested'`. Creates the 4-digit PIN.
- Success `200`: the ride, status `accepted` (driver does not see the PIN).
- Errors: `403` not a driver · `404` unknown id · `409` driver offline, driver has an active ride, or ride no longer `requested`

## 11. POST /rides/:id/decline — Not implemented yet
- Auth: driver
- Writes a `declined` ride_event; the ride stays open for others and disappears from this driver's requests.
- Success `200`: `{ "declined": true }`
- Errors: `403` · `404` · `409` ride is not `requested`

## 12. POST /rides/:id/arrived — Not implemented yet
- Auth: driver (the ride's driver)
- `accepted → arrived`
- Success `200`: the ride, status `arrived`.
- Errors: `403` · `404` not your ride · `409` wrong status

## 13. POST /rides/:id/start — Not implemented yet
- Auth: driver (the ride's driver)
- Body: `{ "pin": "4821" }` (4 digits)
- `arrived → started` only if the PIN matches. A wrong PIN adds 1 to `pin_attempts`; at `PIN_MAX_ATTEMPTS` (default 5) the start is locked.
- Success `200`: the ride, status `started`.
- Errors: `400` malformed or wrong PIN · `403` · `404` not your ride · `409` wrong status · `423` too many wrong PINs

## 14. POST /rides/:id/complete — Not implemented yet
- Auth: driver (the ride's driver)
- `started → completed`
- Success `200`: the ride, status `completed`.
- Errors: `403` · `404` · `409` wrong status

## 15. POST /rides/:id/rating — Not implemented yet
- Auth: rider of the ride
- Body: `{ "stars": 1-5, "tip": 0 (optional, whole rupees, not negative), "comment": "optional, max 500" }`
- Only once, only after `completed`.
- Success `201`: `{ ride_id, stars, tip, comment, created_at }`
- Errors: `400` · `403` · `404` · `409` ride not completed or already rated

## 16. POST /drivers/status — Not implemented yet
- Auth: driver
- Body: `{ "is_online": true }`
- Cannot go offline during an active ride.
- Success `200`: the driver profile.
- Errors: `400` · `403` · `409` active ride

## 17. GET /drivers/requests — Not implemented yet
- Auth: driver
- `requested` rides within `NEARBY_RADIUS_KM` of the driver's last location, matching their `vehicle_type`, excluding rides this driver declined. `[]` if offline.
- Success `200`: array of rides (no `start_pin`).
- Errors: `403`

## 18. POST /drivers/location — Not implemented yet
- Auth: driver
- Body: `{ "lat": 28.61, "lng": 77.2 }`
- Success `200`: the driver profile with the new location.
- Errors: `400` · `403`

## 19. GET /drivers/earnings — Not implemented yet
- Auth: driver
- Success `200`: `{ "today": 0, "week": 0, "rides": [ completed rides ] }` (whole rupees).
- Errors: `403`

## 20. POST /push-tokens — Not implemented yet
- Auth: any
- Body: `{ "token": "ExponentPushToken[...]", "platform": "ios|android" }`
- Saves or updates; a token already stored moves to the caller.
- Success `200`: `{ "token": "...", "platform": "..." }`
- Errors: `400`
