const db = require('../wrapper/db');

const run = (client) => client || db;

// A key still "processing" after this long is assumed abandoned (the server died mid-request) and can be taken over.
const STALE_SECONDS = 60;

// Claims a key. Returns { claimed: true } when this request may run, or { claimed: false, row } with the earlier one.
// The INSERT is the lock: two requests with the same key cannot both succeed.
const claim = async ({ userId, key, route, requestHash }, client) => {
  const { rows } = await run(client).query(
    `INSERT INTO idempotency_keys (user_id, key, route, request_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, key) DO UPDATE
       SET route = EXCLUDED.route, request_hash = EXCLUDED.request_hash, created_at = now()
       WHERE idempotency_keys.status = 'processing'
         AND idempotency_keys.created_at < now() - ($5::int * interval '1 second')
     RETURNING key`,
    [userId, key, route, requestHash, STALE_SECONDS]
  );
  if (rows.length) return { claimed: true };
  const existing = await run(client).query(
    'SELECT route, request_hash, status, response_status, response_body FROM idempotency_keys WHERE user_id = $1 AND key = $2',
    [userId, key]
  );
  return { claimed: false, row: existing.rows[0] };
};

const complete = async ({ userId, key, responseStatus, responseBody }, client) => {
  await run(client).query(
    `UPDATE idempotency_keys
     SET status = 'done', response_status = $3, response_body = $4
     WHERE user_id = $1 AND key = $2`,
    [userId, key, responseStatus, JSON.stringify(responseBody)]
  );
};

// Used when the request failed: the client may retry with the same key and run again.
const release = async ({ userId, key }, client) => {
  await run(client).query('DELETE FROM idempotency_keys WHERE user_id = $1 AND key = $2', [userId, key]);
};

// Keys are only useful for a short while.
const deleteOlderThanHours = async (hours, client) => {
  await run(client).query(
    "DELETE FROM idempotency_keys WHERE created_at < now() - ($1::int * interval '1 hour')",
    [hours]
  );
};

module.exports = { claim, complete, release, deleteOlderThanHours };
