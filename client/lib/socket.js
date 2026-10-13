import { WS_URL } from './config';

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30000;

// status: idle | connecting | online | reconnecting | failed
//  failed = server ne permanently mana kar diya (jaise Origin allow-list mein nahi); retry nahi karte

/**
 * Ek WebSocket connection ka manager (singleton, neeche export).
 *  - connect(token) pe `auth` message bhejta hai, auth.ok milne par status = online
 *  - connection toote to exponential backoff (1s, 2s, 4s ... 30s, + jitter) se reconnect
 *  - reconnect ke baad onReconnect listeners chalte hain (missed messages fetch karne ke liye)
 *  - on(type, fn) se server events subscribe
 */
class SocketManager {
  constructor() {
    this.ws = null;
    this.token = null;
    this.status = 'idle';
    this.failReason = null;
    this.manual = true; // true = hamne khud band kiya / start nahi hua; reconnect nahi karna
    this.attempt = 0;
    this.timer = null;
    this.hadConnection = false; // is session mein kabhi auth.ok mila?
    this.presence = null; // userId -> username; snapshot + presence events se bhara, late subscribers ko replay hota hai
    this.handlers = new Map(); // event type -> Set<fn>
    this.statusListeners = new Set();
    this.reconnectListeners = new Set();
    this.onBrowserOnline = () => this.retryNow();
    this.onVisible = () => document.visibilityState === 'visible' && this.retryNow();
  }

  // Same token ke saath dobara call safe hai (React Strict Mode double-effect)
  connect(token) {
    if (!this.manual && this.token === token) return;
    this.teardown();
    this.token = token;
    this.manual = false;
    this.attempt = 0;
    this.hadConnection = false;
    this.failReason = null;
    window.addEventListener('online', this.onBrowserOnline);
    document.addEventListener('visibilitychange', this.onVisible);
    this.open();
  }

  disconnect() {
    this.teardown();
    this.setStatus('idle');
  }

  teardown() {
    this.manual = true;
    clearTimeout(this.timer);
    this.timer = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onBrowserOnline);
      document.removeEventListener('visibilitychange', this.onVisible);
    }
    if (this.ws) {
      const old = this.ws;
      this.ws = null; // handlers `this.ws !== ws` dekh ke ignore ho jate hain
      old.close();
    }
    this.token = null;
    this.presence = null;
  }

  open() {
    this.setStatus(this.hadConnection ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws === ws) ws.send(JSON.stringify({ type: 'auth', token: this.token }));
    };

    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      let data;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      if (data.type === 'auth.ok') {
        const isReconnect = this.hadConnection;
        this.hadConnection = true;
        this.attempt = 0;
        this.setStatus('online');
        this.emit(data);
        if (isReconnect) this.reconnectListeners.forEach((fn) => fn());
        return;
      }
      if (data.type === 'presence.snapshot') {
        this.presence = new Map((data.users || []).map((u) => [u.id, u.username]));
      } else if (data.type === 'presence' && this.presence) {
        if (data.online) this.presence.set(data.userId, data.username);
        else this.presence.delete(data.userId);
      }
      this.emit(data);
    };

    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.manual) return;
      // 4001 = token galat/expired. 'auth timeout' network slowness ho sakta hai, usse retry
      if (e.code === 4001 && e.reason !== 'auth timeout') {
        this.emit({ type: 'auth.failed' });
        return this.disconnect();
      }
      if (e.code === 4003) {
        this.failReason = 'This site is not allowed to connect to the server (check CLIENT_ORIGIN on the server).';
        this.teardown();
        return this.setStatus('failed');
      }
      this.scheduleReconnect();
    };

    ws.onerror = () => {}; // close event ke baad handle hota hai
  }

  scheduleReconnect() {
    this.setStatus('reconnecting');
    const base = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** this.attempt);
    const delay = base * (1 + Math.random() * 0.25); // jitter: sab clients ek saath na tootein
    this.attempt += 1;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.open(), delay);
  }

  // internet wapas aaya / tab dobara dikha: backoff ka intezaar mat karo
  retryNow() {
    if (this.manual || this.status !== 'reconnecting' || this.ws) return;
    clearTimeout(this.timer);
    this.attempt = 0;
    this.open();
  }

  send(event) {
    if (this.status !== 'online' || !this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(event));
    return true;
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    // signup/login ke turant baad socket chat UI se pehle connect ho jata hai: snapshot miss na ho
    if (type === 'presence.snapshot' && this.presence) {
      fn({ type, users: [...this.presence].map(([id, username]) => ({ id, username })) });
    }
    return () => this.handlers.get(type)?.delete(fn);
  }

  onReconnect(fn) {
    this.reconnectListeners.add(fn);
    return () => this.reconnectListeners.delete(fn);
  }

  emit(data) {
    this.handlers.get(data.type)?.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error('socket handler error:', err);
      }
    });
  }

  setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((fn) => fn());
  }

  // useSyncExternalStore ke liye
  subscribeStatus = (fn) => {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  };
  getStatus = () => this.status;
}

export const socket = new SocketManager();
