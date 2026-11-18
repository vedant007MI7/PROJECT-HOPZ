import { io } from 'socket.io-client';
import { API_URL } from './config';

// The socket lives at the server's root, the REST API under /api.
const ORIGIN = API_URL.replace(/\/api\/?$/, '');

// Opens the WebSocket with the same token as the REST API. `handlers` maps event names to functions.
// The server only sends small "something changed" messages; the app still fetches details through the API,
// so polling stays as the safety net (slower while the socket is up).
export function connectRealtime(token, handlers, { onUp, onDown } = {}) {
  const socket = io(ORIGIN, {
    auth: { token },
    transports: ['websocket'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  Object.entries(handlers).forEach(([event, fn]) => socket.on(event, fn));
  socket.on('connect', () => onUp && onUp());
  socket.on('disconnect', () => onDown && onDown());
  return socket;
}
