const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../function/app-error');

// `tv` is the user's token_version when the token was issued (see business/session.business.js).
const signToken = (user) =>
  jwt.sign({ role: user.role, tv: user.token_version || 0 }, config.jwtSecret, {
    subject: user.id,
    expiresIn: config.jwtExpiresIn,
  });

// Checks the signature and expiry only. Whether the token was revoked is checked separately (session.isCurrent).
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return { id: payload.sub, role: payload.role, tv: payload.tv };
  } catch {
    // Same message for expired and tampered tokens; the client just logs in again.
    throw new AppError('Invalid or expired token', 401);
  }
}

module.exports = { signToken, verifyToken };
