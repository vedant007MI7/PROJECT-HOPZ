const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../function/app-error');

const signToken = (user) =>
  jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: user.id,
    expiresIn: config.jwtExpiresIn,
  });

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return { id: payload.sub, role: payload.role };
  } catch {
    // Same message for expired and tampered tokens; the client just logs in again.
    throw new AppError('Invalid or expired token', 401);
  }
}

module.exports = { signToken, verifyToken };
