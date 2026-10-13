const http = require('http');
const mongoose = require('mongoose');
const config = require('./config');
const { connectDb } = require('./db');
const { createApp } = require('./app');
const hub = require('./ws/hub');

async function main() {
  await connectDb();
  console.log('MongoDB connected');

  const server = http.createServer(createApp());
  hub.attach(server);

  server.listen(config.port, () => console.log(`Server: http://localhost:${config.port}`));

  // Render deploy/restart par SIGTERM bhejta hai; connections saaf band karo
  const shutdown = () => {
    console.log('Shutting down...');
    hub.close();
    server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});
