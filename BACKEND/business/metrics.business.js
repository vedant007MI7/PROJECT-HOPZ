const { monitorEventLoopDelay } = require('perf_hooks');
const metrics = require('../wrapper/metrics');
const db = require('../wrapper/db');
const razorpay = require('../wrapper/razorpay');
const mailer = require('../wrapper/mailer');
const metricsRepo = require('../datadomain/metrics.repository');
const logger = require('../wrapper/logger');

// How late timers fire. If this grows, the server is too busy to keep up (long synchronous work, CPU limit).
const loop = monitorEventLoopDelay({ resolution: 20 });
loop.enable();

const BREAKER_STATE = { closed: 0, 'half-open': 1, open: 2 };
const STATUSES = ['requested', 'accepted', 'arrived', 'started'];

// Business numbers come from the database. They are cached briefly so a busy scraper cannot add load.
const CACHE_MS = 10000;
let cached = { at: 0, value: null };

async function businessGauges() {
  if (cached.value && Date.now() - cached.at < CACHE_MS) return cached.value;
  try {
    const [rows, online] = await Promise.all([metricsRepo.activeRidesByStatus(), metricsRepo.onlineDrivers()]);
    const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.count]));
    const value = [
      {
        name: 'hopz_active_rides',
        help: 'Rides not yet finished, by status.',
        samples: STATUSES.map((status) => ({ labels: { status }, value: byStatus[status] || 0 })),
      },
      { name: 'hopz_online_drivers', help: 'Drivers currently online.', samples: [{ value: online }] },
    ];
    cached = { at: Date.now(), value };
    return value;
  } catch (err) {
    // If the database is down, the server numbers are still worth returning.
    logger.error({ err }, 'Could not read business metrics');
    return [];
  }
}

function processGauges() {
  const pool = db.pool;
  return [
    { name: 'hopz_process_uptime_seconds', help: 'Seconds since the server started.', samples: [{ value: Math.round(process.uptime()) }] },
    { name: 'hopz_process_memory_bytes', help: 'Memory used by this process (resident set).', samples: [{ value: process.memoryUsage().rss }] },
    { name: 'hopz_event_loop_delay_p99_seconds', help: '99th percentile delay of the event loop.', samples: [{ value: loop.percentile(99) / 1e9 }] },
    {
      name: 'hopz_db_pool_connections',
      help: 'Database connections in this process: open, idle, and requests waiting for one.',
      samples: [
        { labels: { state: 'total' }, value: pool.totalCount },
        { labels: { state: 'idle' }, value: pool.idleCount },
        { labels: { state: 'waiting' }, value: pool.waitingCount },
      ],
    },
    {
      name: 'hopz_circuit_breaker_state',
      help: 'Outside services: 0 = normal, 1 = testing again, 2 = open (calls are being skipped).',
      samples: [
        { labels: { service: 'razorpay' }, value: BREAKER_STATE[razorpay.breaker.state] },
        { labels: { service: 'brevo' }, value: BREAKER_STATE[mailer.breaker.state] },
      ],
    },
  ];
}

async function renderMetrics() {
  return metrics.render([...processGauges(), ...(await businessGauges())]);
}

module.exports = { renderMetrics };
