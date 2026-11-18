require('dotenv').config();

const env = process.env;

// Fail at startup, not on the first request that needs the value.
const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((k) => !env[k]);
if (missing.length) {
  console.error(
    `Missing required environment variable(s): ${missing.join(', ')}.\n` +
      'Copy .env.example to .env and fill them in.'
  );
  process.exit(1);
}

const int = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

module.exports = {
  port: int(env.PORT, 3000),
  nodeEnv: env.NODE_ENV || 'development',
  databaseUrl: env.DATABASE_URL,
  // Most connections one server process keeps open to Postgres.
  dbPoolMax: int(env.PG_POOL_MAX, 10),
  // A single query running longer than this is stopped by the database.
  dbStatementTimeoutMs: int(env.DB_STATEMENT_TIMEOUT_MS, 15000),
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  pinMaxAttempts: int(env.PIN_MAX_ATTEMPTS, 5),
  nearbyRadiusKm: num(env.NEARBY_RADIUS_KM, 5),
  // Dispatch in waves: a new request goes to the nearest `waveSize` drivers first, and `waveSize` more every
  // `waveSeconds`, until `fullAfterSeconds` when everyone in range sees it. waveSize 0 = show to everyone at once.
  dispatchWaveSize: env.DISPATCH_WAVE_SIZE === undefined ? 3 : Math.max(0, parseInt(env.DISPATCH_WAVE_SIZE, 10) || 0),
  dispatchWaveSeconds: int(env.DISPATCH_WAVE_SECONDS, 15),
  dispatchFullAfterSeconds: int(env.DISPATCH_FULL_AFTER_SECONDS, 60),
  // Surge pricing (fare multiplier when demand > supply near the pickup). Off unless SURGE_ENABLED=true.
  surgeEnabled: env.SURGE_ENABLED === 'true',
  surgeRadiusKm: num(env.SURGE_RADIUS_KM, 3),
  surgeMaxMultiplier: num(env.SURGE_MAX_MULTIPLIER, 2),
  // A 'requested' ride nobody accepts is cancelled after this long.
  rideRequestTimeoutSeconds: int(env.RIDE_REQUEST_TIMEOUT_SECONDS, 180),
  // Ride requests one rider may create per minute.
  rideCreateLimitPerMinute: int(env.RIDE_CREATE_LIMIT_PER_MINUTE, 5),
  // Password-reset codes: how long they last, wrong guesses allowed, and the wait before a new one is sent.
  otpTtlMinutes: int(env.OTP_TTL_MINUTES, 10),
  otpMaxAttempts: int(env.OTP_MAX_ATTEMPTS, 5),
  otpResendSeconds: int(env.OTP_RESEND_SECONDS, 60),
  // How codes reach a phone number. 'log' prints the code in the server log; a real provider would be added in wrapper/sms.js.
  smsProvider: env.SMS_PROVIDER || 'log',
  // Email goes out through Brevo's HTTPS API (free plan). Without these, the code is written to the server log instead.
  brevoApiKey: env.BREVO_API_KEY || '',
  mailFrom: env.MAIL_FROM || '',
  mailFromName: env.MAIL_FROM_NAME || 'Hopz',
  // Razorpay keys (use rzp_test_ keys in development). Without them, online payment returns 503.
  razorpayKeyId: env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: env.RAZORPAY_KEY_SECRET || '',
  // Redis (optional): where drivers are right now. Tests never use the real one unless TEST_REDIS_URL is set.
  redisUrl: env.NODE_ENV === 'test' ? env.TEST_REDIS_URL || '' : env.REDIS_URL || '',
  redisKeyPrefix: env.NODE_ENV === 'test' ? 'hopz:test:' : 'hopz:',
  // A driver who sends nothing for this long is treated as gone.
  driverLocationTtlSeconds: int(env.DRIVER_LOCATION_TTL_SECONDS, 30),
  // The database copy of a driver's position is refreshed at most this often.
  driverLocationSaveSeconds: int(env.DRIVER_LOCATION_SAVE_SECONDS, 60),
  // Protects GET /metrics. Empty: open in development, hidden in production.
  // Socket.IO across several server instances: a message sent on one instance reaches phones connected to another
  // through Redis pub/sub. Needs REDIS_URL and `npm install @socket.io/redis-adapter`. Off unless SOCKET_REDIS_ADAPTER=true.
  socketRedisAdapter: env.SOCKET_REDIS_ADAPTER === 'true',
  // Background jobs (BullMQ). Needs REDIS_URL. Off unless QUEUE_ENABLED=true (in tests: TEST_QUEUE_ENABLED=true).
  queueEnabled: (env.NODE_ENV === 'test' ? env.TEST_QUEUE_ENABLED : env.QUEUE_ENABLED) === 'true',
  queueDrainDelaySeconds: Number(env.QUEUE_DRAIN_DELAY_SECONDS) || 30,
  metricsToken: env.METRICS_TOKEN || '',
  // Comma-separated allowed origins for browsers; empty = allow all (native apps send no Origin anyway).
  corsOrigins: (env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
};
