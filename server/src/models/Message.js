const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '', maxlength: 1000 },
    reactions: { type: [reactionSchema], default: [] },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// pagination cursor message _id hai (createdAt nahi), kyunki same millisecond ke
// messages createdAt cursor se skip ho jate. _id ek process mein monotonic hota hai.
messageSchema.index({ conversation: 1, _id: -1 });

// Ek hi JSON shape har jagah (REST + WS). `sender` populated hona chahiye.
// Deleted message ka text kabhi client ko nahi jata.
messageSchema.methods.toClient = function () {
  const sender = this.sender && this.sender.username
    ? { id: this.sender._id.toString(), username: this.sender.username }
    : { id: this.sender.toString(), username: 'unknown' };
  const deleted = !!this.deletedAt;

  // do users ek saath naya emoji lagayein to 2 entries ban sakti hain; emoji ke hisaab se merge
  const merged = new Map();
  if (!deleted) {
    for (const r of this.reactions) {
      const users = merged.get(r.emoji) || new Set();
      r.users.forEach((u) => users.add(u.toString()));
      merged.set(r.emoji, users);
    }
  }

  return {
    id: this._id.toString(),
    conversation: this.conversation.toString(),
    sender,
    text: deleted ? '' : this.text,
    reactions: [...merged.entries()]
      .filter(([, users]) => users.size > 0)
      .map(([emoji, users]) => ({ emoji, users: [...users] })),
    editedAt: this.editedAt,
    deletedAt: this.deletedAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Message', messageSchema);
