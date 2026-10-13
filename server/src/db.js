const mongoose = require('mongoose');
const config = require('./config');
const Conversation = require('./models/Conversation');

async function connectDb() {
  await mongoose.connect(config.mongoUri);
  // unique/partial indexes pehle build ho jayein, tabhi seed chalao
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  await seed();
}

// 'general' room hamesha rahe; dobara chalane par duplicate nahi banta
async function seed() {
  await Conversation.updateOne(
    { type: 'room', name: 'general' },
    { $setOnInsert: { type: 'room', name: 'general', members: [], lastMessageAt: new Date() } },
    { upsert: true }
  );
}

module.exports = { connectDb };
