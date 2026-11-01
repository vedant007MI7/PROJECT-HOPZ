// #20 POST /push-tokens
// upsert({ userId, token, platform }): INSERT INTO push_tokens (user_id, token, platform)
//   VALUES ($1,$2,$3) ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id,
//   platform = EXCLUDED.platform, updated_at = now() RETURNING *.
//   A phone that changes accounts takes the token over, which is intended.
const upsert = async () => {
  throw new Error('Not implemented yet');
};

module.exports = { upsert };
