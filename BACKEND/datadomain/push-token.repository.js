const db = require('../wrapper/db');

// A phone that signs in as someone else takes the token over, which is intended.
const upsert = async ({ userId, token, platform }) => {
  const { rows } = await db.query(
    `INSERT INTO push_tokens (user_id, token, platform) VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE
       SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = now()
     RETURNING *`,
    [userId, token, platform]
  );
  return rows[0];
};

module.exports = { upsert };
