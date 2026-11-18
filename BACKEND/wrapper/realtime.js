const { Server } = require('socket.io');
const { verifyToken } = require('./token');
const config = require('../config');
const logger = require('./logger');

// Real-time push to the apps (Socket.IO / WebSocket). The server tells the phones WHEN something changed; the
// phones then fetch the details through the normal, authorised API. So a socket message never carries private
// data (PIN, phone numbers, fare): it is only a nudge.
//
//   ride:changed        { ride_id, status }    to the rider and the driver of that ride
//   requests:changed    {}                     to every connected driver (a new ride was requested)
//   driver:location     { ride_id, lat, lng }  to the rider, while their driver is on the way / on the trip
//
// Each user joins a private room "user:<id>"; sending to a user means sending to that room. Everything here is a
// no-op until attach() has been called (tests and scripts that never start a server are unaffected).

let io = null;
let adapterClients = [];

// With several server instances, io.to(room).emit() only reaches sockets connected to THIS instance. The Redis
// adapter publishes every emit on a Redis channel, and each instance forwards it to its own sockets.
// Opt-in (SOCKET_REDIS_ADAPTER=true): it costs one Redis command per emit. A missing package is logged, not fatal.
function useRedisAdapter(server) {
  if (!config.socketRedisAdapter || !config.redisUrl) return;
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const IORedis = require('ioredis');
    const pub = new IORedis(config.redisUrl);
    const sub = pub.duplicate();
    for (const c of [pub, sub]) c.on('error', (err) => logger.warn({ err: err.message }, 'Socket.IO adapter Redis error'));
    adapterClients = [pub, sub];
    server.adapter(createAdapter(pub, sub));
    logger.info('Socket.IO Redis adapter on');
  } catch (err) {
    logger.warn({ err: err.message }, 'Socket.IO Redis adapter not started (is @socket.io/redis-adapter installed?)');
  }
}

function attach(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.corsOrigins.length ? config.corsOrigins : true },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  useRedisAdapter(io);

  // Same JWT as the REST API, sent once when the socket connects.
  io.use(async (socket, next) => {
    try {
      const claims = verifyToken(String((socket.handshake.auth && socket.handshake.auth.token) || ''));
      // Loaded here, not at the top: session.business uses this file (it closes sockets).
      if (!(await require('../business/session.business').isCurrent(claims.id, claims.tv))) throw new Error('revoked');
      socket.data.user = { id: claims.id, role: claims.role };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.data.user;
    socket.join(`user:${id}`);
    if (role === 'driver') socket.join('drivers');
  });

  logger.info('Socket.IO attached');
  return io;
}

const enabled = () => io !== null;
const connections = () => (io ? io.engine.clientsCount : 0);

function emitToUser(userId, event, payload) {
  if (io && userId) io.to(`user:${userId}`).emit(event, payload);
}

function emitToDrivers(event, payload = {}) {
  if (io) io.to('drivers').emit(event, payload);
}

// `ride` is a ride row (it has rider_id, driver_id, status).
function rideChanged(ride) {
  if (!io || !ride) return;
  const payload = { ride_id: ride.id, status: ride.status };
  emitToUser(ride.rider_id, 'ride:changed', payload);
  emitToUser(ride.driver_id, 'ride:changed', payload);
}

// A user's logins were cancelled: close their open sockets (they cannot reconnect with the old token).
function disconnectUser(userId) {
  if (io && userId) io.in(`user:${userId}`).disconnectSockets(true);
}

// Called on shutdown: ends every socket so the HTTP server can close.
function close() {
  if (io) io.disconnectSockets(true);
}

// Tests: shut Socket.IO (and its HTTP server) down completely and go back to "not attached".
async function stop() {
  if (!io) return;
  const current = io;
  io = null;
  await new Promise((resolve) => current.close(resolve));
  adapterClients.forEach((c) => c.disconnect());
  adapterClients = [];
}

module.exports = { attach, enabled, connections, emitToUser, emitToDrivers, rideChanged, disconnectUser, close, stop };
