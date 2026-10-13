const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['room', 'dm'], required: true },
    // sirf rooms ke liye; lowercase [a-z0-9_-]
    name: { type: String, trim: true, lowercase: true },
    // DM mein exactly 2; public rooms mein khali (sab access kar sakte hain)
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // DM ke liye sorted "idA:idB", taaki same pair ke 2 DM na bane
    dmKey: { type: String },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

conversationSchema.index({ name: 1 }, { unique: true, partialFilterExpression: { type: 'room' } });
conversationSchema.index({ dmKey: 1 }, { unique: true, partialFilterExpression: { type: 'dm' } });
conversationSchema.index({ members: 1 });

conversationSchema.methods.hasMember = function (userId) {
  return this.members.some((m) => m.toString() === userId.toString());
};

// public room sab ke liye, DM sirf members ke liye
conversationSchema.methods.canAccess = function (userId) {
  return this.type === 'room' || this.hasMember(userId);
};

module.exports = mongoose.model('Conversation', conversationSchema);
