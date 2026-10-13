const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const { requireAuth } = require('./middleware/auth');

function createApp() {
  const app = express();

  // Render jaise proxy ke peeche rate-limit sahi IP dekh sake
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // no Origin = curl/server-to-server/same-origin; browsers hamesha bhejte hain
        if (!origin || config.clientOrigins.includes(origin)) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
      },
    })
  );
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', require('./routes/auth'));
  app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user.toPublic() }));
  app.use('/api', require('./routes/conversations'));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.message === 'Not allowed by CORS') {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
