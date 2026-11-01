const { Pool } = require('pg');
const config = require('../config');
const logger = require('./logger');

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

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
