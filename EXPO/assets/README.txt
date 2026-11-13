Put these in your Expo project's assets/ folder (overwrite the defaults) and in app.json set:
"icon": "./assets/icon.png",
"splash": { "image": "./assets/splash-icon.png", "resizeMode": "contain", "backgroundColor": "#172A3A" },
"android": { "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#14212C" } },
"web": { "favicon": "./assets/favicon.png" }
