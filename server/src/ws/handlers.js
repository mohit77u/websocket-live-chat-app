const mongoose = require('mongoose');
const { z } = require('zod');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');
const text = z.string().trim().min(1).max(1000);
const ref = z.string().max(64).optional(); // client ka correlation id; error mein wapas aata hai

const schemas = {
  'message.send': z.object({ conversationId: objectId, text, ref }),
  'message.edit': z.object({ messageId: objectId, text, ref }),
  'message.delete': z.object({ messageId: objectId, ref }),
  'reaction.toggle': z.object({ messageId: objectId, emoji: z.enum(EMOJIS), ref }),
  typing: z.object({ conversationId: objectId, ref }),
};

function fail(hub, ws, code, message, event) {
  hub.send(ws, { type: 'error', code, message, ref: event?.ref });
}

// message load + (DM ho to) membership check. Fail par error bhej ke null return.
async function loadMessage(hub, ws, event) {
  const msg = await Message.findById(event.messageId);
  if (!msg) return fail(hub, ws, 'not_found', 'Message not found', event), null;
  const conv = await Conversation.findById(msg.conversation);
  if (!conv || !conv.canAccess(ws.user.id)) return fail(hub, ws, 'forbidden', 'Forbidden', event), null;
  return { msg, conv };
}

async function publishUpdate(hub, msg, conv) {
  await msg.populate('sender', 'username');
  hub.sendToConversation(conv, { type: 'message.updated', message: msg.toClient() });
}

const handlers = {
  async 'message.send'(hub, ws, e) {
    const conv = await Conversation.findById(e.conversationId);
    if (!conv) return fail(hub, ws, 'not_found', 'Conversation not found', e);
    if (!conv.canAccess(ws.user.id)) return fail(hub, ws, 'forbidden', 'Forbidden', e);

    const msg = await Message.create({ conversation: conv._id, sender: ws.user.id, text: e.text });
    await Conversation.updateOne({ _id: conv._id }, { $set: { lastMessageAt: msg.createdAt } });
    await msg.populate('sender', 'username');
    hub.sendToConversation(conv, { type: 'message.new', message: msg.toClient() });
  },

  async 'message.edit'(hub, ws, e) {
    const found = await loadMessage(hub, ws, e);
    if (!found) return;
    const { msg, conv } = found;
    // ownership server pe check; client pe bharosa nahi
    if (msg.sender.toString() !== ws.user.id) return fail(hub, ws, 'forbidden', 'You can only edit your own messages', e);
    if (msg.deletedAt) return fail(hub, ws, 'deleted', 'Message was deleted', e);

    msg.text = e.text;
    msg.editedAt = new Date();
    await msg.save();
    await publishUpdate(hub, msg, conv);
  },

  async 'message.delete'(hub, ws, e) {
    const found = await loadMessage(hub, ws, e);
    if (!found) return;
    const { msg, conv } = found;
    if (msg.sender.toString() !== ws.user.id) return fail(hub, ws, 'forbidden', 'You can only delete your own messages', e);
    if (msg.deletedAt) return; // already deleted: idempotent

    // soft delete: content DB se bhi hata dete hain
    msg.deletedAt = new Date();
    msg.text = '';
    msg.reactions = [];
    await msg.save();
    await publishUpdate(hub, msg, conv);
  },

  async 'reaction.toggle'(hub, ws, e) {
    const found = await loadMessage(hub, ws, e);
    if (!found) return;
    const { msg, conv } = found;
    if (msg.deletedAt) return fail(hub, ws, 'deleted', 'Message was deleted', e);

    const userId = new mongoose.Types.ObjectId(ws.user.id);
    const has = msg.reactions.some((r) => r.emoji === e.emoji && r.users.some((u) => u.equals(userId)));

    // atomic updates, taaki do users ek saath react karein to kuch overwrite na ho
    if (has) {
      await Message.updateOne({ _id: msg._id, 'reactions.emoji': e.emoji }, { $pull: { 'reactions.$.users': userId } });
    } else {
      const added = await Message.updateOne(
        { _id: msg._id, 'reactions.emoji': e.emoji },
        { $addToSet: { 'reactions.$.users': userId } }
      );
      if (added.matchedCount === 0) {
        await Message.updateOne({ _id: msg._id }, { $push: { reactions: { emoji: e.emoji, users: [userId] } } });
      }
    }
    const fresh = await Message.findById(msg._id);
    await publishUpdate(hub, fresh, conv);
  },

  async typing(hub, ws, e) {
    const conv = await Conversation.findById(e.conversationId);
    if (!conv || !conv.canAccess(ws.user.id)) return; // typing pe error ka fayda nahi
    hub.sendToConversation(
      conv,
      { type: 'typing', conversationId: conv.id, userId: ws.user.id, username: ws.user.username },
      { exceptUserId: ws.user.id }
    );
  },
};

async function handleEvent(hub, ws, event) {
  const schema = schemas[event.type];
  if (!schema) return; // unknown type ignore
  const parsed = schema.safeParse(event);
  if (!parsed.success) return fail(hub, ws, 'invalid', 'Invalid event', event);
  await handlers[event.type](hub, ws, parsed.data);
}

module.exports = { handleEvent, EMOJIS };
