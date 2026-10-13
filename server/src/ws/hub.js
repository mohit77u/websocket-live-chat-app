const { WebSocketServer, WebSocket } = require('ws');
const { z } = require('zod');
const config = require('../config');
const { userFromToken } = require('../middleware/auth');
const { handleEvent } = require('./handlers');

const authSchema = z.object({ type: z.literal('auth'), token: z.string().min(1).max(2000) });

// ek socket 10s mein itne events se zyada nahi bhej sakta
const RATE_WINDOW_MS = 10000;
const RATE_MAX_EVENTS = 100;

// Saare WebSocket connections, presence aur broadcast yahin se. Ek singleton (module end mein).
class Hub {
  constructor() {
    this.wss = null;
    this.heartbeat = null;
    this.byUser = new Map(); // userId -> Set<ws> (ek user ke multiple tabs)
  }

  attach(server) {
    this.wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));

    // dead connections (laptop sleep, wifi gaya) hatane ke liye ping/pong
    this.heartbeat = setInterval(() => {
      for (const ws of this.wss.clients) {
        if (!ws.isAlive) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }, config.pingIntervalMs);
    this.wss.on('close', () => clearInterval(this.heartbeat));
  }

  close() {
    clearInterval(this.heartbeat);
    // wss.close() purane connections band nahi karta. Unhe 1001 (going away) bhejo taaki clients
    // turant reconnect shuru karein (deploy/restart par important) aur process 5s intezaar na kare.
    for (const ws of this.wss?.clients ?? []) ws.close(1001, 'server shutting down');
    this.wss?.close();
  }

  onConnection(ws, req) {
    const origin = req.headers.origin;
    // browser hamesha Origin bhejta hai; allow-list ke bahar ka origin reject
    if (origin && !config.clientOrigins.includes(origin)) return ws.close(4003, 'origin not allowed');

    ws.isAlive = true;
    ws.user = null; // auth ke baad {id, username}
    ws.queue = Promise.resolve(); // ek socket ke events order mein process hon
    ws.eventCount = 0;
    ws.rateTimer = setInterval(() => (ws.eventCount = 0), RATE_WINDOW_MS);
    ws.authTimer = setTimeout(() => ws.close(4001, 'auth timeout'), config.authTimeoutMs);

    ws.on('pong', () => (ws.isAlive = true));
    ws.on('error', () => {}); // 'close' event cleanup karega
    ws.on('close', () => this.onClose(ws));
    ws.on('message', (raw) => {
      ws.queue = ws.queue.then(() => this.onMessage(ws, raw)).catch((err) => console.error('ws handler error:', err));
    });
  }

  async onMessage(ws, raw) {
    let event;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return; // invalid JSON ignore
    }
    if (!event || typeof event !== 'object') return;

    if (!ws.user) {
      const parsed = authSchema.safeParse(event);
      if (!parsed.success) return ws.close(4001, 'auth required');
      const user = await userFromToken(parsed.data.token);
      if (!user) return ws.close(4001, 'invalid token');
      return this.onAuthenticated(ws, user);
    }

    if (++ws.eventCount > RATE_MAX_EVENTS) {
      return this.send(ws, { type: 'error', code: 'rate_limited', message: 'Slow down' });
    }
    await handleEvent(this, ws, event);
  }

  onAuthenticated(ws, user) {
    clearTimeout(ws.authTimer);
    ws.user = { id: user._id.toString(), username: user.username };

    const sockets = this.byUser.get(ws.user.id) || new Set();
    const wasOffline = sockets.size === 0;
    sockets.add(ws);
    this.byUser.set(ws.user.id, sockets);

    this.send(ws, { type: 'auth.ok', user: ws.user });
    this.send(ws, { type: 'presence.snapshot', userIds: [...this.byUser.keys()], users: this.onlineUsers() });
    if (wasOffline) {
      this.broadcastAll({ type: 'presence', userId: ws.user.id, username: ws.user.username, online: true }, ws);
    }
  }

  // online users ki list [{id, username}] (har user ek baar, chahe kitne bhi tabs)
  onlineUsers() {
    return [...this.byUser.entries()].map(([id, sockets]) => ({ id, username: sockets.values().next().value.user.username }));
  }

  onClose(ws) {
    clearTimeout(ws.authTimer);
    clearInterval(ws.rateTimer);
    if (!ws.user) return;
    const sockets = this.byUser.get(ws.user.id);
    if (!sockets) return;
    sockets.delete(ws);
    // user tab tab offline maana jata hai jab uska koi bhi socket open nahi
    if (sockets.size === 0) {
      this.byUser.delete(ws.user.id);
      this.broadcastAll({ type: 'presence', userId: ws.user.id, username: ws.user.username, online: false });
    }
  }

  send(ws, event) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
  }

  sendToUser(userId, event) {
    for (const ws of this.byUser.get(userId.toString()) || []) this.send(ws, event);
  }

  // sab authenticated sockets ko (optionally ek socket chhodke)
  broadcastAll(event, exceptWs = null) {
    for (const sockets of this.byUser.values()) {
      for (const ws of sockets) if (ws !== exceptWs) this.send(ws, event);
    }
  }

  // public room -> sab authenticated; DM -> sirf uske 2 members
  // exceptUserId: us user ke saare sockets ko skip (typing indicator ke liye)
  sendToConversation(conv, event, { exceptUserId = null } = {}) {
    if (conv.type === 'room') {
      for (const [userId, sockets] of this.byUser) {
        if (userId === exceptUserId) continue;
        for (const ws of sockets) this.send(ws, event);
      }
      return;
    }
    for (const memberId of conv.members) {
      if (memberId.toString() === exceptUserId) continue;
      this.sendToUser(memberId, event);
    }
  }
}

module.exports = new Hub();
