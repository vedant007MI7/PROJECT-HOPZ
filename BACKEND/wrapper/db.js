const { Pool } = require('pg');
const config = require('../config');
const logger = require('./logger');

// max: how many queries run at once from this process. Idle connections are closed after 30 s, and a request
// waits at most 10 s for a free one (long enough for Neon to wake up) instead of hanging forever.
// statement_timeout: the database stops any single query that runs longer than this, so one runaway query
// cannot hold a connection (and everything queued behind it) indefinitely.
// On Render, use Neon's pooled connection string (host contains "-pooler"): Neon's PgBouncer then shares a few
// real database connections between many app connections, which matters once there are several server instances.
const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: config.dbStatementTimeoutMs,
});

// Idle clients can error (Neon closes idle connections); don't crash the process.
pool.on('error', (err) => logger.error({ err }, 'Unexpected idle pg client error'));

const query = (text, params) => pool.query(text, params);

// fn receives a client; repositories accept it as their last argument.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
