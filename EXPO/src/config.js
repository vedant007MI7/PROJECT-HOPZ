import Constants from 'expo-constants';

// Deployed backend: set EXPO_PUBLIC_API_URL in the app's .env, e.g.
//   EXPO_PUBLIC_API_URL=https://hopz-api.onrender.com/api
// Leave it unset in development and the app uses your PC's LAN address (same Wi-Fi).
const host = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
export const API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${host}:3000/api`;
