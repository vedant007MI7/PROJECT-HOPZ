# Hopz app

React Native (Expo SDK 58) app for riders and drivers. It talks to the Hopz backend in [`../BACKEND`](../BACKEND).

## Run

1. `npm install`
2. Copy `.env.example` to `.env` and fill it in (below).
3. `npx expo start` (add `-c` after changing `.env`), then open it in Expo Go on a phone.

## Environment (`.env`)

| Name | What it is |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | The backend address, ending in `/api`. Without it the app uses your computer's address on port 3000. |
| `EXPO_PUBLIC_OLA_MAPS_KEY` | Ola Maps API key, used for destination search. Without it, only the built-in suggestions work. |

`.env` is not committed. Anything starting with `EXPO_PUBLIC_` is readable inside the app, so never put a real secret in it.

## What is where

- `src/state.js`: app state, GPS, polling, and every action (book, accept, pay, log out).
- `src/api.js`: every call to the backend, with one error message for no connection.
- `src/screens/`: Entry (splash, login, signup, password reset), Rider, Driver, Lists (activity, earnings, profile), Pay (Razorpay checkout in a WebView).
- `src/components/RealMap.js`: the map behind the screens, with pins and the road route.
- `src/places.js` and `src/routes.js`: destination search (Ola Maps) and road routes (OSRM), each in one file so the provider can be swapped.

## Credits

Map tiles: © OpenStreetMap contributors, © CARTO. Place search: Ola Maps. Road routes: OSRM.
