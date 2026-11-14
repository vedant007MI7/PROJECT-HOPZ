import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';

const TOKEN_KEY = 'hopz_token';
let token = null;
let onUnauthorized = () => {};

// Kept in memory for requests and in the device's secure storage so login survives a reload.
// SecureStore can be missing (web) or fail; the in-memory token still works then.
export async function setToken(t) {
  token = t;
  try {
    if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Not persisted; login just won't survive a reload.
  }
}
export async function loadToken() {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}
// Called when the server rejects our token (expired, account gone).
export const hasToken = () => !!token;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No internet connection, or the server is not responding. Check your connection and try again.');
  }
  // A wrong password is also a 401, but then we hold no token yet, so only real expiries get here.
  if (res.status === 401 && token) {
    setToken(null);
    onUnauthorized();
  }
  const json = await res.json().catch(() => null);
  if (!json || !json.success) throw new Error(json?.error || `Request failed (${res.status})`);
  return json.data;
}

const post = (path, body) => request('POST', path, body || {});

export const api = {
  login: (identifier, password) => post('/auth/login', { identifier, password }),
  signup: (b) => post('/auth/signup', b),
  forgotPassword: (identifier) => post('/auth/forgot-password', { identifier }),
  resetPassword: (b) => post('/auth/reset-password', b),
  me: () => request('GET', '/users/me'),
  // rides
  createRide: (b) => post('/rides', b),
  ride: (id) => request('GET', `/rides/${id}`),
  rides: (q = '') => request('GET', `/rides${q}`),
  cancel: (id) => post(`/rides/${id}/cancel`),
  rate: (id, b) => post(`/rides/${id}/rating`, b),
  pay: (id) => post(`/rides/${id}/pay`),
  verifyPay: (id, b) => post(`/rides/${id}/pay/verify`, b),
  // driver
  accept: (id) => post(`/rides/${id}/accept`),
  decline: (id) => post(`/rides/${id}/decline`),
  arrived: (id) => post(`/rides/${id}/arrived`),
  start: (id, pin) => post(`/rides/${id}/start`, { pin }),
  complete: (id) => post(`/rides/${id}/complete`),
  setOnline: (is_online) => post('/drivers/status', { is_online }),
  location: (lat, lng) => post('/drivers/location', { lat, lng }),
  requests: () => request('GET', '/drivers/requests'),
  earnings: () => request('GET', '/drivers/earnings'),
  pushToken: (tok, platform) => post('/push-tokens', { token: tok, platform }),
};
