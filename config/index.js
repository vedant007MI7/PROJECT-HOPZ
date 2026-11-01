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
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  pinMaxAttempts: int(env.PIN_MAX_ATTEMPTS, 5),
  nearbyRadiusKm: num(env.NEARBY_RADIUS_KM, 5),
};
