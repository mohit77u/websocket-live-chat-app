/* Server verification: `npm run verify`
 * Apna server alag port + alag DB (ws_chat_verify) pe chalata hai, REST + WebSocket se check
 * karta hai, phir DB drop karke server band kar deta hai. Dev data ko haath nahi lagata.
 */
const { spawn } = require('child_process');
const path = require('path');
const mongoose = require('mongoose');
const WebSocket = require('ws');

const PORT = 4100;
const API = `http://localhost:${PORT}/api`;
const WS_URL = `ws://localhost:${PORT}/ws`;
const MONGO_URI = 'mongodb://127.0.0.1:27017/ws_chat_verify';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function check(name, cond, extra = '') {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  -> ${extra}`}`);
}
const section = (t) => console.log(`\n# ${t}`);

async function api(method, p, token, body) {
  const res = await fetch(API + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

// WebSocket test client: events jama karta hai; waitFor/expectNone se assert
class Client {
  constructor(label) {
    this.label = label;
    this.events = [];
    this.cursor = 0;
    this.closed = null;
    this.listeners = [];
  }

  open({ origin, autoPong = true } = {}) {
    return new Promise((resolve) => {
      this.ws = new WebSocket(WS_URL, { headers: origin ? { Origin: origin } : undefined, autoPong });
      this.ws.on('open', () => resolve(this));
      this.ws.on('message', (d) => {
        this.events.push(JSON.parse(d.toString()));
        this.listeners.forEach((l) => l());
      });
      this.ws.on('close', (code) => {
        this.closed = { code };
        this.listeners.forEach((l) => l());
        resolve(this); // connect hote hi close ho gaya (origin reject) to bhi resolve
      });
      this.ws.on('error', () => {});
    });
  }

  send(obj) {
    this.ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj));
  }

  async auth(token) {
    this.send({ type: 'auth', token });
    return this.waitFor((e) => e.type === 'auth.ok');
  }

  // cursor ke baad pehla matching event; mil jaye to cursor uske aage
  waitFor(pred, ms = 2000) {
    return new Promise((resolve) => {
      const find = () => {
        for (let i = this.cursor; i < this.events.length; i++) {
          if (pred(this.events[i])) {
            this.cursor = i + 1;
            return this.events[i];
          }
        }
        return null;
      };
      const hit = find();
      if (hit) return resolve(hit);
      const timer = setTimeout(() => {
        this.listeners = this.listeners.filter((l) => l !== listener);
        resolve(null);
      }, ms);
      const listener = () => {
        const e = find();
        if (e) {
          clearTimeout(timer);
          this.listeners = this.listeners.filter((l) => l !== listener);
          resolve(e);
        }
      };
      this.listeners.push(listener);
    });
  }

  // ab tak ke saare events ignore (agle waitFor/expectNone sirf naye dekhenge)
  skip() {
    this.cursor = this.events.length;
  }

  // ms tak koi matching event nahi aana chahiye
  async expectNone(pred, ms = 500) {
    await sleep(ms);
    return !this.events.slice(this.cursor).some(pred);
  }

  waitClose(ms = 6000) {
    return new Promise((resolve) => {
      if (this.closed) return resolve(this.closed);
      const t = setTimeout(() => resolve(null), ms);
      const l = () => {
        if (this.closed) {
          clearTimeout(t);
          resolve(this.closed);
        }
      };
      this.listeners.push(l);
    });
  }

  close() {
    this.ws?.close();
  }
}

async function signup(name) {
  const r = await api('POST', '/auth/signup', null, { username: name, email: `${name}@v.com`, password: 'password123' });
  return { token: r.json.token, id: r.json.user.id, username: name };
}

async function connected(user) {
  const c = await new Client(user.username).open();
  const ok = await c.auth(user.token);
  if (!ok) throw new Error(`auth failed for ${user.username}`);
  return c;
}

async function startServer() {
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      MONGO_URI,
      PING_INTERVAL_MS: '500',
      AUTH_RATE_LIMIT_MAX: '1000',
      CLIENT_ORIGIN: 'http://localhost:3000',
    },
  });
  let out = '';
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`server did not start:\n${out}`)), 15000);
    const onData = (d) => {
      out += d.toString();
      if (out.includes('Server:')) {
        clearTimeout(t);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (d) => (out += d.toString()));
    child.on('exit', (code) => reject(new Error(`server exited early (${code}):\n${out}`)));
  });
  child.removeAllListeners('exit');
  return child;
}

async function run() {
  const sfx = Math.random().toString(36).slice(2, 6);
  const [A, B, C] = await Promise.all([signup(`va_${sfx}`), signup(`vb_${sfx}`), signup(`vc_${sfx}`)]);
  const general = (await api('GET', '/conversations', A.token)).json.conversations.find((c) => c.name === 'general');

  section('1. WebSocket auth');
  {
    const c = await new Client('noauth').open();
    const t0 = Date.now();
    const closed = await c.waitClose(7000);
    check('no auth message -> closed 4001 within ~5s', closed?.code === 4001 && Date.now() - t0 < 6500, JSON.stringify(closed));

    const bad = await new Client('badtoken').open();
    bad.send({ type: 'auth', token: 'garbage.token.here' });
    check('invalid token -> closed 4001', (await bad.waitClose(2000))?.code === 4001);

    const wrongFirst = await new Client('wrongfirst').open();
    wrongFirst.send({ type: 'message.send', conversationId: general.id, text: 'sneaky' });
    check('non-auth first message -> closed 4001', (await wrongFirst.waitClose(2000))?.code === 4001);

    const evil = await new Client('evil').open({ origin: 'http://evil.example' });
    check('disallowed Origin -> closed 4003', (await evil.waitClose(2000))?.code === 4003);

    const good = await new Client('goodorigin').open({ origin: 'http://localhost:3000' });
    check('allowed Origin can auth', !!(await good.auth(A.token)));
    good.close();
  }

  section('2. Messaging + presence');
  const a = await connected(A);
  const b = await connected(B);
  {
    const snap = await b.waitFor((e) => e.type === 'presence.snapshot');
    check('presence.snapshot lists online users incl. A', snap && snap.userIds.includes(A.id) && snap.userIds.includes(B.id), JSON.stringify(snap));
    check('presence.snapshot also carries usernames', snap?.users?.some((u) => u.id === A.id && u.username === A.username), JSON.stringify(snap?.users));
    const came = await a.waitFor((e) => e.type === 'presence' && e.userId === B.id && e.online);
    check('A notified that B came online (with username)', came?.username === B.username, JSON.stringify(came));

    a.send({ type: 'message.send', conversationId: general.id, text: '  hello world  ' });
    const got = await b.waitFor((e) => e.type === 'message.new');
    check('B receives message.new (trimmed text, sender, shape)', got && got.message.text === 'hello world' && got.message.sender.username === A.username && got.message.conversation === general.id && Array.isArray(got.message.reactions), JSON.stringify(got));
    check('A (sender) also receives message.new', !!(await a.waitFor((e) => e.type === 'message.new')));

    const hist = await api('GET', `/conversations/${general.id}/messages`, B.token);
    check('message persisted (REST history)', hist.json.messages.some((m) => m.id === got.message.id));

    // typing
    a.send({ type: 'typing', conversationId: general.id });
    check('B receives typing from A', !!(await b.waitFor((e) => e.type === 'typing' && e.userId === A.id)));
    check('A does not receive own typing', await a.expectNone((e) => e.type === 'typing', 400));
  }

  section('3. Edit / delete ownership');
  {
    a.send({ type: 'message.send', conversationId: general.id, text: 'original' });
    const m = (await b.waitFor((e) => e.type === 'message.new' && e.message.text === 'original')).message;
    await a.waitFor((e) => e.type === 'message.new' && e.message.id === m.id);

    b.send({ type: 'message.edit', messageId: m.id, text: 'hacked', ref: 'r1' });
    const err1 = await b.waitFor((e) => e.type === 'error' && e.ref === 'r1');
    check("B can't edit A's message (error forbidden, ref echoed)", err1?.code === 'forbidden');
    b.send({ type: 'message.delete', messageId: m.id, ref: 'r2' });
    check("B can't delete A's message", (await b.waitFor((e) => e.type === 'error' && e.ref === 'r2'))?.code === 'forbidden');
    check('no update leaked to A after rejected attempts', await a.expectNone((e) => e.type === 'message.updated', 300));
    const still = (await api('GET', `/conversations/${general.id}/messages`, A.token)).json.messages.find((x) => x.id === m.id);
    check('message unchanged in DB after rejected edit/delete', still.text === 'original' && !still.deletedAt && !still.editedAt);

    a.send({ type: 'message.edit', messageId: m.id, text: 'edited text' });
    const upd = await b.waitFor((e) => e.type === 'message.updated' && e.message.id === m.id);
    check('A edits -> B gets message.updated with editedAt', upd?.message.text === 'edited text' && !!upd.message.editedAt, JSON.stringify(upd));

    a.send({ type: 'message.delete', messageId: m.id });
    const del = await b.waitFor((e) => e.type === 'message.updated' && e.message.id === m.id && e.message.deletedAt);
    check('A deletes -> B gets updated: deletedAt set, text empty', del && del.message.text === '', JSON.stringify(del));
    const delDb = (await api('GET', `/conversations/${general.id}/messages`, B.token)).json.messages.find((x) => x.id === m.id);
    check('deleted text not served via REST either', delDb.text === '' && !!delDb.deletedAt);

    a.send({ type: 'message.edit', messageId: m.id, text: 'zombie', ref: 'r3' });
    check('edit after delete -> error deleted', (await a.waitFor((e) => e.type === 'error' && e.ref === 'r3'))?.code === 'deleted');
    a.send({ type: 'message.delete', messageId: m.id });
    check('delete twice is a no-op (no extra update)', await b.expectNone((e) => e.type === 'message.updated' && e.message.id === m.id, 400));
  }

  section('4. Reactions');
  {
    a.send({ type: 'message.send', conversationId: general.id, text: 'react to me' });
    const m = (await b.waitFor((e) => e.type === 'message.new' && e.message.text === 'react to me')).message;
    await a.waitFor((e) => e.type === 'message.new' && e.message.id === m.id);

    b.send({ type: 'reaction.toggle', messageId: m.id, emoji: '👍' });
    let u = await a.waitFor((e) => e.type === 'message.updated' && e.message.id === m.id);
    check('B reacts 👍 -> A sees reaction [B]', u?.message.reactions.length === 1 && u.message.reactions[0].emoji === '👍' && u.message.reactions[0].users.join() === B.id, JSON.stringify(u?.message.reactions));

    a.send({ type: 'reaction.toggle', messageId: m.id, emoji: '👍' });
    u = await b.waitFor((e) => e.type === 'message.updated' && e.message.id === m.id && e.message.reactions[0]?.users.length === 2);
    check('A also 👍 (same emoji) -> users [B, A]', !!u && u.message.reactions[0].users.includes(A.id) && u.message.reactions[0].users.includes(B.id), JSON.stringify(u?.message.reactions));

    b.send({ type: 'reaction.toggle', messageId: m.id, emoji: '👍' });
    u = await a.waitFor((e) => e.type === 'message.updated' && e.message.id === m.id && e.message.reactions[0]?.users.length === 1);
    check('B toggles 👍 off -> only A remains', u?.message.reactions[0].users.join() === A.id);

    a.send({ type: 'reaction.toggle', messageId: m.id, emoji: '👍' });
    u = await b.waitFor((e) => e.type === 'message.updated' && e.message.id === m.id && e.message.reactions.length === 0);
    check('last user off -> reactions empty', !!u);

    // race: dono ek saath naya emoji
    a.send({ type: 'reaction.toggle', messageId: m.id, emoji: '🎉' });
    b.send({ type: 'reaction.toggle', messageId: m.id, emoji: '🎉' });
    await sleep(500);
    const final = (await api('GET', `/conversations/${general.id}/messages`, A.token)).json.messages.find((x) => x.id === m.id);
    const party = final.reactions.filter((r) => r.emoji === '🎉');
    check('concurrent first-reaction race: one 🎉 entry with both users', party.length === 1 && party[0].users.length === 2, JSON.stringify(final.reactions));

    b.send({ type: 'reaction.toggle', messageId: m.id, emoji: '💩', ref: 'r4' });
    check('emoji outside allowed set -> error invalid', (await b.waitFor((e) => e.type === 'error' && e.ref === 'r4'))?.code === 'invalid');
  }

  section('5. DM privacy');
  const c = await connected(C);
  {
    const dmRes = await api('POST', '/dms', A.token, { username: B.username });
    const dm = dmRes.json.conversation;
    const created = await b.waitFor((e) => e.type === 'conversation.new');
    check('B gets conversation.new for new DM (otherUser = A)', created?.conversation.id === dm.id && created.conversation.otherUser.username === A.username, JSON.stringify(created));
    check('C gets no conversation.new for A-B DM', await c.expectNone((e) => e.type === 'conversation.new', 300));

    a.send({ type: 'message.send', conversationId: dm.id, text: 'private stuff' });
    const toB = await b.waitFor((e) => e.type === 'message.new' && e.message.conversation === dm.id);
    check('B receives DM message', toB?.message.text === 'private stuff');
    check('C does NOT receive DM message', await c.expectNone((e) => e.type === 'message.new', 500));

    c.send({ type: 'message.send', conversationId: dm.id, text: 'intruder', ref: 'd1' });
    check('C cannot send into A-B DM', (await c.waitFor((e) => e.type === 'error' && e.ref === 'd1'))?.code === 'forbidden');
    c.send({ type: 'reaction.toggle', messageId: toB.message.id, emoji: '👍', ref: 'd2' });
    check('C cannot react to DM message', (await c.waitFor((e) => e.type === 'error' && e.ref === 'd2'))?.code === 'forbidden');
    c.send({ type: 'typing', conversationId: dm.id });
    check('C typing in DM is not delivered', await a.expectNone((e) => e.type === 'typing' && e.userId === C.id, 400));
    check('C cannot fetch DM history (REST 403)', (await api('GET', `/conversations/${dm.id}/messages`, C.token)).status === 403);

    const dmHist = await api('GET', `/conversations/${dm.id}/messages`, B.token);
    check('DM message persisted, B can fetch', dmHist.json.messages.length === 1);
  }

  section('6. conversation.new for rooms');
  {
    const roomName = `room-${sfx}`;
    const r = await api('POST', '/rooms', A.token, { name: roomName });
    const ev = await b.waitFor((e) => e.type === 'conversation.new' && e.conversation.name === roomName);
    check('creating a room notifies other users live', r.status === 201 && !!ev);
  }

  section('7. Presence with multiple tabs');
  {
    a.skip();
    const c2 = await connected(C); // C ka doosra socket
    check('C 2nd tab does not re-announce online', await a.expectNone((e) => e.type === 'presence' && e.userId === C.id && e.online, 300));
    c.close();
    await sleep(300);
    check('C still online while 2nd tab open (no offline event)', await a.expectNone((e) => e.type === 'presence' && e.userId === C.id && !e.online, 300));
    c2.close();
    check('A notified when C fully offline', !!(await a.waitFor((e) => e.type === 'presence' && e.userId === C.id && !e.online)));
  }

  section('8. Heartbeat (server PING_INTERVAL_MS=500)');
  {
    const dead = await new Client('deadpeer').open({ autoPong: false });
    await dead.auth(A.token);
    const closed = await dead.waitClose(4000);
    check('client that never pongs is terminated', !!closed, 'still open after 4s');
    await sleep(1800);
    check('normal client (auto-pong) stays connected', !a.closed && a.ws.readyState === WebSocket.OPEN);
  }

  section('9. Reconnect catch-up (REST after=)');
  {
    const hist = (await api('GET', `/conversations/${general.id}/messages`, A.token)).json.messages;
    const lastSeen = hist[hist.length - 1].id;
    a.close(); // A offline
    const b2 = b;
    for (const t of ['missed 1', 'missed 2', 'missed 3']) b2.send({ type: 'message.send', conversationId: general.id, text: t });
    await sleep(600);
    const missed = (await api('GET', `/conversations/${general.id}/messages?after=${lastSeen}`, A.token)).json;
    check('after=<lastSeen> returns exactly the 3 missed, in order', missed.messages.map((m) => m.text).join('|') === 'missed 1|missed 2|missed 3', JSON.stringify(missed.messages.map((m) => m.text)));
  }

  section('10. Robustness');
  {
    const x = await connected(A);
    x.send('this is not json');
    x.send(JSON.stringify({ type: 'totally.unknown' }));
    x.send(JSON.stringify([1, 2, 3]));
    x.send(JSON.stringify({ type: 'message.send', conversationId: general.id, text: '' }));
    x.send(JSON.stringify({ type: 'message.send', conversationId: general.id, text: 'x'.repeat(1001), ref: 'big' }));
    x.send(JSON.stringify({ type: 'message.send', conversationId: 'not-an-id', text: 'hi', ref: 'badid' }));
    x.send(JSON.stringify({ type: 'message.edit', messageId: new mongoose.Types.ObjectId().toString(), text: 'x', ref: 'nf' }));
    check('1001-char text -> error invalid', (await x.waitFor((e) => e.type === 'error' && e.ref === 'big'))?.code === 'invalid');
    check('bad conversationId -> error invalid', (await x.waitFor((e) => e.type === 'error' && e.ref === 'badid'))?.code === 'invalid');
    check('edit unknown message -> error not_found', (await x.waitFor((e) => e.type === 'error' && e.ref === 'nf'))?.code === 'not_found');
    const codes = x.events.filter((e) => e.type === 'error').map((e) => e.code).join();
    check('non-JSON/array/unknown events silently ignored; only the 4 bad known events errored', codes === 'invalid,invalid,invalid,not_found' && x.ws.readyState === WebSocket.OPEN, codes);
    check('server still healthy', (await fetch(`${API}/health`)).status === 200);

    const huge = await connected(B);
    huge.send(JSON.stringify({ type: 'message.send', conversationId: general.id, text: 'y'.repeat(20000) }));
    check('oversized frame (>16KB) -> connection closed 1009', (await huge.waitClose(2000))?.code === 1009);
    x.close();
  }

  b.close();
  c.close();
}

(async () => {
  let server;
  let exitCode = 0;
  try {
    // pehle se bacha hua verify DB saaf
    await mongoose.connect(MONGO_URI);
    await mongoose.connection.dropDatabase();
    server = await startServer();
    await run();
  } catch (err) {
    console.error('\nVERIFY CRASHED:', err);
    exitCode = 2;
  } finally {
    server?.kill('SIGTERM');
    try {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    } catch {}
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(exitCode || (fail ? 1 : 0));
})();
