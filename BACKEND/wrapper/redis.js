const Redis = require('ioredis');
const config = require('../config');
const logger = require('./logger');
const { CircuitBreaker } = require('./resilience');

// Redis is an optional speed-up, never a requirement: with no REDIS_URL (or when Redis is down) the callers
// fall back to the database. The breaker stops us from waiting on a dead Redis for every request.
const breaker = new CircuitBreaker({ name: 'Redis', failureThreshold: 3, openMs: 15000 });

let client = null;
let lastError = 0;

function create(url) {
  const c = new Redis(url, {
    connectTimeout: 3000,
    commandTimeout: 1500, // a slow Redis must not make requests slow: give up and use the database
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 500, 5000), // keep trying to reconnect in the background
  });
  // Without a listener, a connection error would crash the process. Logged at most every 30 s.
  c.on('error', (err) => {
    if (Date.now() - lastError > 30000) {
      lastError = Date.now();
      logger.warn({ err: err.message }, 'Redis connection problem');
    }
  });
  return c;
}

if (config.redisUrl) client = create(config.redisUrl);

const enabled = () => client !== null;

// Runs fn(client) through the breaker. Throws if Redis is off, down, or the breaker is open;
// callers catch that and use the database instead.
async function run(fn) {
  if (!client) throw new Error('Redis is not configured');
  return breaker.run(() => fn(client));
}

// 'disabled', or the breaker state: closed (normal), half-open (testing again), open (skipped).
const state = () => (client ? breaker.state : 'disabled');

async function close() {
  if (client) await client.quit().catch(() => client.disconnect());
}

// Tests swap in a fake client (or null for "Redis is off").
function setClientForTests(fake) {
  if (client && client !== fake && typeof client.disconnect === 'function') client.disconnect();
  client = fake;
  breaker.reset();
}

module.exports = { run, enabled, state, close, setClientForTests, breaker };
