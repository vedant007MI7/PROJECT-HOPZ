const AppError = require('../function/app-error');
const { verifyToken } = require('../wrapper/token');

function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError('Authentication required', 401);
  req.user = verifyToken(token);
  next();
}

module.exports = requireAuth;
