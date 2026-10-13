const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const ReadState = require('../models/ReadState');

function dmKeyFor(idA, idB) {
  return [idA.toString(), idB.toString()].sort().join(':');
}

// DM exist karta hai to wahi, warna naya (race mein unique index duplicate rokta hai)
async function findOrCreateDm(userA, userB) {
  const dmKey = dmKeyFor(userA._id, userB._id);
  let conv = await Conversation.findOne({ dmKey });
  if (conv) return { conv, created: false };
  try {
    conv = await Conversation.create({ type: 'dm', members: [userA._id, userB._id], dmKey });
    return { conv, created: true };
  } catch (err) {
    if (err.code !== 11000) throw err;
    return { conv: await Conversation.findOne({ dmKey }), created: false };
  }
}

// viewer ke nazariye se conversation ka JSON. DM mein members populated hone chahiye.
function serializeConversation(conv, viewerId, extras = {}) {
  const base = {
    id: conv._id.toString(),
    type: conv.type,
    name: conv.name || null,
    lastMessageAt: conv.lastMessageAt,
    lastMessage: null,
    unreadCount: 0,
    ...extras,
  };
  if (conv.type === 'dm') {
    const other = conv.members.find((m) => m._id.toString() !== viewerId.toString());
    base.otherUser = other ? { id: other._id.toString(), username: other.username } : null;
  }
  return base;
}

// viewer ke liye har conversation + lastMessage + unread. Demo scale ke liye per-conversation
// queries theek hain; bahut bade scale par aggregation pipeline chahiye.
async function listForUser(user) {
  const [rooms, dms, readStates] = await Promise.all([
    Conversation.find({ type: 'room' }),
    Conversation.find({ type: 'dm', members: user._id }).populate('members', 'username'),
    ReadState.find({ user: user._id }).lean(),
  ]);
  const readAt = new Map(readStates.map((r) => [r.conversation.toString(), r.lastReadAt]));

  const all = [...rooms, ...dms];
  const items = await Promise.all(
    all.map(async (conv) => {
      // read state nahi to signup ke baad ke messages hi unread maane jayenge
      const since = readAt.get(conv._id.toString()) || user.createdAt;
      const [last, unreadCount] = await Promise.all([
        Message.findOne({ conversation: conv._id }).sort({ _id: -1 }).populate('sender', 'username'),
        Message.countDocuments({
          conversation: conv._id,
          createdAt: { $gt: since },
          sender: { $ne: user._id },
          deletedAt: null,
        }),
      ]);
      return serializeConversation(conv, user._id, {
        lastMessage: last ? last.toClient() : null,
        unreadCount,
      });
    })
  );
  return items.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
}

module.exports = { dmKeyFor, findOrCreateDm, serializeConversation, listForUser };
