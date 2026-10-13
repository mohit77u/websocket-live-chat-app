const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// public shape: passwordHash/email kabhi dusre users ko nahi jata
userSchema.methods.toPublic = function () {
  return { id: this._id.toString(), username: this.username };
};

module.exports = mongoose.model('User', userSchema);
