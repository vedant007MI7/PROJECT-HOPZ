const pushTokenRepo = require('../datadomain/push-token.repository');

async function saveToken(user, { token, platform }) {
  const row = await pushTokenRepo.upsert({ userId: user.id, token, platform });
  return { token: row.token, platform: row.platform };
}

module.exports = { saveToken };
