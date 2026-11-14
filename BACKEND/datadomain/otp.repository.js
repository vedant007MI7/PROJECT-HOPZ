const db = require('../wrapper/db');

const run = (client) => client || db;

// A new code replaces any earlier one for the same user and purpose.
const replace = async ({ userId, purpose, codeHash, ttlMinutes }, client) => {
  await run(client).query('DELETE FROM otp_codes WHERE user_id = $1 AND purpose = $2', [userId, purpose]);
  const { rows } = await run(client).query(
    `INSERT INTO otp_codes (user_id, purpose, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + ($4::int * interval '1 minute'))
     RETURNING id`,
    [userId, purpose, codeHash, ttlMinutes]
  );
  return rows[0];
};

// Ages and expiry are worked out by the database clock, so server and DB times can't disagree.
const findLatest = async (userId, purpose, client, forUpdate = false) => {
  const { rows } = await run(client).query(
    `SELECT *,
            EXTRACT(EPOCH FROM (now() - created_at)) AS age_seconds,
            (expires_at <= now()) AS expired
     FROM otp_codes
     WHERE user_id = $1 AND purpose = $2
     ORDER BY created_at DESC LIMIT 1
     ${forUpdate ? 'FOR UPDATE' : ''}`,
    [userId, purpose]
  );
  return rows[0] || null;
};

const addAttempt = async (id, client) => {
  await run(client).query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [id]);
};

const markUsed = async (id, client) => {
  await run(client).query('UPDATE otp_codes SET used_at = now() WHERE id = $1', [id]);
};

module.exports = { replace, findLatest, addAttempt, markUsed };
