const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const ReadState = require('../models/ReadState');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { findOrCreateDm, serializeConversation, listForUser } = require('../services/conversations');
const hub = require('../ws/hub');

const router = express.Router();

const PAGE_SIZE = 50;
const CATCHUP_SIZE = 200;

const roomSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{3,30}$/, 'Room name must be 3-30 chars: a-z, 0-9, _ or -'),
});
const dmSchema = z.object({ username: z.string().trim().toLowerCase().min(1, 'Username is required') });

const isId = (v) => mongoose.isValidObjectId(v);

// conversation load + access check; fail par response bhej deta hai aur null return karta hai
async function loadAccessible(req, res) {
  if (!isId(req.params.id)) {
    res.status(400).json({ error: 'Invalid conversation id' });
    return null;
  }
  const conv = await Conversation.findById(req.params.id);
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return null;
  }
  if (!conv.canAccess(req.user._id)) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return conv;
}

router.get('/conversations', requireAuth, async (req, res) => {
  res.json({ conversations: await listForUser(req.user) });
});

router.post('/rooms', requireAuth, validateBody(roomSchema), async (req, res) => {
  try {
    const conv = await Conversation.create({ type: 'room', name: req.body.name, members: [] });
    const payload = serializeConversation(conv, req.user._id);
    // baaki sab ke sidebar mein naya room turant dikhe
    hub.broadcastAll({ type: 'conversation.new', conversation: payload });
    res.status(201).json({ conversation: payload });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Room name already taken', field: 'name' });
    throw err;
  }
});

router.post('/dms', requireAuth, validateBody(dmSchema), async (req, res) => {
  const other = await User.findOne({ username: req.body.username });
  if (!other) return res.status(404).json({ error: 'User not found' });
  if (other._id.equals(req.user._id)) return res.status(400).json({ error: "You can't DM yourself" });

  const { conv, created } = await findOrCreateDm(req.user, other);
  await conv.populate('members', 'username');
  // dusre user ke sidebar mein bhi DM dikhe (uske nazariye se serialize)
  if (created) hub.sendToUser(other._id, { type: 'conversation.new', conversation: serializeConversation(conv, other._id) });
  res.json({ conversation: serializeConversation(conv, req.user._id) });
});

router.get('/users', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  // user input se regex banate waqt escape karna zaroori hai (ReDoS/injection)
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const users = await User.find({ _id: { $ne: req.user._id }, username: new RegExp(`^${escaped}`) })
    .sort({ username: 1 })
    .limit(10);
  res.json({ users: users.map((u) => u.toPublic()) });
});

// ?before=<messageId> purane messages (pagination), ?after=<messageId> naye (reconnect catch-up).
// Dono nahi to latest page. Response hamesha oldest -> newest.
router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  const conv = await loadAccessible(req, res);
  if (!conv) return;

  const { before, after } = req.query;
  if ((before && !isId(before)) || (after && !isId(after))) {
    return res.status(400).json({ error: 'Invalid cursor' });
  }
  if (before && after) return res.status(400).json({ error: 'Use either before or after' });

  const filter = { conversation: conv._id };
  let limit = PAGE_SIZE;
  let sort = { _id: -1 };
  if (before) filter._id = { $lt: before };
  if (after) {
    filter._id = { $gt: after };
    limit = CATCHUP_SIZE;
    sort = { _id: 1 };
  }

  // 1 extra fetch karke pata chalta hai aur messages hain ya nahi
  const docs = await Message.find(filter).sort(sort).limit(limit + 1).populate('sender', 'username');
  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  if (!after) page.reverse();

  res.json({ messages: page.map((m) => m.toClient()), hasMore });
});

router.post('/conversations/:id/read', requireAuth, async (req, res) => {
  const conv = await loadAccessible(req, res);
  if (!conv) return;
  await ReadState.updateOne(
    { user: req.user._id, conversation: conv._id },
    { $set: { lastReadAt: new Date() } },
    { upsert: true }
  );
  res.json({ ok: true });
});

module.exports = router;
