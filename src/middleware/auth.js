const jwt = require('jsonwebtoken');
const config = require('../config');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, error: 'Missing bearer token', code: 'UNAUTHORIZED' });
  }

  try {
    req.tokenPayload = jwt.verify(token, config.auth.jwtSecret);
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
  }
}

module.exports = { requireAuth };
