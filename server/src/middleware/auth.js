const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

// valid token -> User document, warna null (REST aur WebSocket dono yahi use karte hain)
async function userFromToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return await User.findById(payload.sub);
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = await userFromToken(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
}

module.exports = { signToken, userFromToken, requireAuth };
