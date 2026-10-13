require('dotenv').config({ quiet: true });

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}
if (isProd && !process.env.MONGO_URI) {
  throw new Error('MONGO_URI is required in production');
}

module.exports = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ws_chat',
  // dev fallback sirf local ke liye; production mein upar throw ho jata hai
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: '7d',
  // WebSocket heartbeat; env se chhota kar sakte hain testing ke liye
  pingIntervalMs: Number(process.env.PING_INTERVAL_MS) || 30000,
  authTimeoutMs: 5000,
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
