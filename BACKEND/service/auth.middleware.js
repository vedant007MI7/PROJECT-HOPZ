const AppError = require('../function/app-error');
const { verifyToken } = require('../wrapper/token');
const session = require('../business/session.business');

const INVALID = 'Invalid or expired token';

async function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError('Authentication required', 401);
  const claims = verifyToken(token);
  // A token from before a password change / "log out everywhere" is refused, even if it has not expired.
  if (!(await session.isCurrent(claims.id, claims.tv))) throw new AppError(INVALID, 401);
  req.user = { id: claims.id, role: claims.role };
  next();
}

module.exports = requireAuth;
