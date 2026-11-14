# Hopz

A ride-hailing app built end to end: a React Native app for riders and drivers, and a Node.js API with Postgres behind it.

Live API: https://project-hopz.onrender.com/api/health (free tier, so the first request after a pause can be slow)

| Folder | What it is |
| --- | --- |
| [`BACKEND/`](BACKEND) | Node.js + Express 5 REST API, Postgres on Neon, tests. [Backend README](BACKEND/README.md) and [API contract](BACKEND/docs/api.md) |
| [`EXPO/`](EXPO) | React Native app (Expo). [App README](EXPO/README.md) |

## What it does

- Sign up and log in as a rider or a driver; stay logged in across reloads; reset a forgotten password with a one-time code sent to a phone number or email.
- Rider: real GPS pickup, destination search, fare estimate, choose Auto, Mini or Sedan, pay by cash or online, watch the driver arrive on a live map, share a start PIN, rate the trip.
- Driver: go online (live GPS every 5 seconds), see nearby requests, accept, navigate to pickup, verify the rider's PIN, complete the trip, see earnings and what to collect.
- Rides that no driver accepts cancel themselves after a time limit.
- Online payment through Razorpay (test mode), verified on the server.

## Architecture

```
Expo app (React Native)  ──HTTPS/JSON──▶  Express API (Render)  ──SQL──▶  Postgres (Neon)
   │  expo-location, react-native-maps          │  service → business → datadomain → wrapper
   │  Ola Maps (search), OSRM (road routes)     └─ Razorpay (orders), Brevo email / SMS sender
   └─ Razorpay checkout in a WebView
```

The app polls the API every few seconds for ride updates. WebSockets would be the next step for real-time updates.

## Design decisions worth knowing

- **Race-safe accepting:** one atomic `UPDATE ... WHERE status = 'requested'` plus partial unique indexes, so two drivers can never take the same ride.
- **The server owns the money:** fare and distance are computed in the backend, and a ride is marked paid only after the Razorpay signature checks out.
- **Layered backend** so routes, rules and SQL stay separate and testable; the test suite runs against a separate Neon branch.
- **Swappable providers:** maps search, routing, SMS and email each sit behind one small file, so a provider can change without touching the rest.

## Run it locally

1. Backend: follow [`BACKEND/README.md`](BACKEND/README.md) (needs a Neon database).
2. App: `cd EXPO`, copy `.env.example` to `.env`, set `EXPO_PUBLIC_API_URL` (your backend, ending in `/api`) and `EXPO_PUBLIC_OLA_MAPS_KEY`, then `npm install` and `npx expo start`. Open it in Expo Go.

## Known limits

- Push notifications are not built (they need a development build, not Expo Go).
- SMS delivery is a logging stub; real SMS in India needs a DLT-registered provider.
- Payments run in Razorpay test mode only; driver payouts are not implemented.
- Updates use polling instead of WebSockets.
