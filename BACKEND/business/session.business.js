const cache = require('../wrapper/cache');
const realtime = require('../wrapper/realtime');
const userRepo = require('../datadomain/user.repository');

// Revoking logins. A login token (JWT) is checked by its signature alone, so on its own it stays valid until it
// expires (7 days) even after the password changed or the user logged out everywhere. To fix that, every user has a
// `token_version` number; each token carries the version it was issued under (`tv`), and a token is only accepted
// while its version equals the user's current one. Changing the password, or "log out everywhere", adds 1.
//
// Reading the current version on every request would cost a database round trip, so it is cached twice:
//   - in this process's memory for 30 s (a few microseconds), then
//   - in Redis for 5 minutes (shared by all instances), then the database.
// When the version changes, the memory and Redis entries are deleted at once on the instance that handled the
// change, so it takes effect immediately there. Other instances keep their memory copy for at most 30 s.
// That 30 s is the price of not asking the database on every request, and it is the number to quote.

const MEMORY_TTL_MS = 30000;
const REDIS_TTL_SECONDS = 300;
const memory = new Map(); // userId -> { version, until }
const key = (userId) => `tv:${userId}`;

// The user's current version, or null if the user no longer exists.
async function currentVersion(userId) {
  const hit = memory.get(userId);
  if (hit && hit.until > Date.now()) return hit.version;
  const version = await cache.getOrSet(key(userId), REDIS_TTL_SECONDS, () => userRepo.tokenVersion(userId));
  if (memory.size > 10000) memory.clear(); // keep memory bounded
  memory.set(userId, { version, until: Date.now() + MEMORY_TTL_MS });
  return version;
}

// Is a token issued under version `claimed` still good? Tokens from before this feature have no `tv`: version 0.
async function isCurrent(userId, claimed) {
  const version = await currentVersion(userId);
  return version !== null && version === (claimed ?? 0);
}

// Forget what we know about this user's version (call after it changed).
async function forget(userId) {
  memory.delete(userId);
  await cache.del(key(userId));
}

// "Log out everywhere": every token issued so far stops working, and open sockets are closed.
async function revokeAll(userId) {
  await userRepo.bumpTokenVersion(userId);
  await afterChange(userId);
}

// After ANY change of the version (password change or reset): drop caches and close the user's sockets.
async function afterChange(userId) {
  await forget(userId);
  realtime.disconnectUser(userId);
}

module.exports = { isCurrent, currentVersion, forget, revokeAll, afterChange };
