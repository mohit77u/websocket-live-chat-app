const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

// brute-force/spam se bachne ke liye; test ke liye env se badal sakte hain
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again in a minute' },
});

const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, 'Username must be 3-20 chars: a-z, 0-9, _'),
  email: z.string().trim().toLowerCase().pipe(z.email('Invalid email')),
  // bcrypt 72 bytes ke baad truncate karta hai, isliye max 72
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password too long'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

// timing se pata na chale ki email exist karta hai ya nahi
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

router.post('/signup', limiter, validateBody(signupSchema), async (req, res) => {
  const { username, email, password } = req.body;

  const clash = await User.findOne({ $or: [{ username }, { email }] }).lean();
  if (clash) {
    const field = clash.username === username ? 'username' : 'email';
    return res.status(409).json({ error: `${field === 'username' ? 'Username' : 'Email'} already taken`, field });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let user;
  try {
    user = await User.create({ username, email, passwordHash });
  } catch (err) {
    // do requests ek saath aayein to unique index yahan pakad leta hai
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'username';
      return res.status(409).json({ error: `${field === 'email' ? 'Email' : 'Username'} already taken`, field });
    }
    throw err;
  }
  res.status(201).json({ token: signToken(user), user: user.toPublic() });
});

router.post('/login', limiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: signToken(user), user: user.toPublic() });
});

module.exports = router;
