# Hopz app (Expo / React Native)

All screens on sample data (no backend yet). Rider + driver flows, liquid-glass UI.

## Run
```
npx create-expo-app@latest hopz-app --template blank
cd hopz-app
npx expo install expo-linear-gradient expo-blur react-native-svg expo-font expo-status-bar @expo-google-fonts/dm-sans @expo-google-fonts/sora
```
Then copy `App.js` and the `src/` folder from this zip over the new project (replace App.js), and:
```
npx expo start
```
Scan the QR with Expo Go. Open the folder in VS Code and edit; the phone reloads on save.

## Layout
- `src/theme.js` colours, fonts, glass recipes
- `src/state.js` sample data + app state (replace with API calls later)
- `src/components/` Glass, UI, Icons, Map, Nav
- `src/screens/` Entry, Rider, Driver, Lists

## Logo and app icon
- `src/components/HopLoader.js` is the loading-screen animation (Z hops over h-o-p squeezing each letter, lands, glows). `<HopLoader loop />` repeats while loading; on the splash it plays once. Tap the logo on the splash to replay.
- `src/components/Logo.js` is the wordmark (use `<Logo width={200} />`, `light` prop for light backgrounds).
- `assets/` has icon, adaptive-icon, splash-icon and favicon. Copy them into your project's `assets/` folder and set the paths in `app.json` (see `assets/README.txt`).
