# Pulse Chat

Real-time chat app: accounts, public rooms, direct messages, reactions, edit/delete, typing indicators, presence, auto-reconnect.

**Stack:** Next.js 16 (App Router) + Tailwind v4 · Express 5 + `ws` · MongoDB (mongoose) · JWT auth

| Light | Dark | Mobile |
|-------|------|--------|
| ![light](docs/screenshots/chat-light.png) | ![dark](docs/screenshots/chat-dark.png) | ![mobile](docs/screenshots/mobile-drawer.png) |

## Features
- **Auth:** signup/login (bcrypt + JWT, 7 days), protected routes, WebSocket authenticated with the same token
- **Rooms:** public rooms (anyone can create), history with "Load older" pagination, online-members list
- **Direct messages:** private 1-to-1 (server-enforced, non-members get 403), people search
- **Messages:** edit, soft delete, 6 emoji reactions, typing indicator, unread badges, date separators, message grouping
- **Connection:** server ping/pong heartbeat, client auto-reconnect with exponential backoff, missed messages are re-synced
- **UI:** dark/light theme (persisted), responsive (mobile drawer), skeletons, toasts

## Project layout
```
server/   Express API + WebSocket hub     (port 4000)
  src/    config, db, models/, routes/, services/, middleware/, ws/{hub,handlers}.js
  scripts/verify.js                       end-to-end server checks (npm run verify)
client/   Next.js app                     (port 3000)
  app/    login, signup, chat/[id]
  components/, lib/                       UI, socket manager, chat state
docs/     SPEC-v1/PLAN-v1 (first demo), screenshots
SPEC.md   what we built      PLAN.md   how we built it
```

## Run locally
Needs Node 20+ and MongoDB running on `localhost:27017`.

```bash
# terminal 1: API + WebSocket
cd server
cp .env.example .env        # optional for local dev; defaults work
npm install
npm run dev                 # http://localhost:4000

# terminal 2: web app
cd client
cp .env.example .env.local  # optional for local dev
npm install
npm run dev                 # http://localhost:3000
```
Open http://localhost:3000, create two accounts in two different browsers (or one normal + one private window; tabs of the same browser share the login), and chat.

### Verify the server
```bash
cd server && npm run verify
```
Starts its own server on port 4100 with a throwaway database (`ws_chat_verify`, dropped afterwards) and runs ~50 checks: WS auth, messaging, edit/delete ownership, reactions (including a concurrent-reaction race), DM privacy, presence with multiple tabs, heartbeat, catch-up, and malformed-input robustness.

## Environment variables

**server** (`server/.env`)
| Var | Default (dev) | Notes |
|-----|---------------|-------|
| `PORT` | `4000` | Render sets this automatically |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/ws_chat` | **required in production** |
| `JWT_SECRET` | dev-only fallback | **required in production** (server refuses to start without it). `openssl rand -hex 32` |
| `CLIENT_ORIGIN` | `http://localhost:3000` | comma-separated allowed frontend origins (CORS + WebSocket Origin check), no trailing slash |

**client** (`client/.env.local`)
| Var | Default | Notes |
|-----|---------|-------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | server origin, no `/api` suffix |
| `NEXT_PUBLIC_WS_URL` | derived from API URL (`ws(s)://…/ws`) | only set if WS lives elsewhere |

`NEXT_PUBLIC_*` values are baked in at **build time**, so redeploy the client after changing them.

## How it works
```
Browser (Next.js)  ── REST  /api/*   (Bearer JWT) ──▶ Express ──▶ MongoDB
        └────────── WebSocket /ws (first message: {type:"auth", token}) ──┘
```
- **WS protocol** (JSON): client sends `auth`, `message.send`, `message.edit`, `message.delete`, `reaction.toggle`, `typing`; server sends `auth.ok`, `message.new`, `message.updated`, `typing`, `presence`, `presence.snapshot`, `conversation.new`, `error`. Details: `server/src/ws/handlers.js`.
- The token is sent as the first WS message (not in the URL) so it doesn't end up in access logs. Unauthenticated sockets are closed after 5 s.
- Rooms and DMs are one `Conversation` model (`type: room | dm`); messages are paginated by `_id` cursor.
- On reconnect the client refetches the latest page and merges it, so missed messages **and** missed edits/deletes/reactions are picked up.

## Deploy (free tiers)
Order matters: database → server → client → tell the server the client URL.

### 1. MongoDB Atlas
1. Create a free **M0** cluster.
2. *Database Access* → add a user (username + password).
3. *Network Access* → add `0.0.0.0/0` (Render's outbound IPs are not fixed; the DB user's password is your protection, so make it strong).
4. *Connect → Drivers* → copy the connection string and add a database name:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/ws_chat?retryWrites=true&w=majority`

### 2. Server on Render
1. Push this repo to GitHub.
2. Render → *New → Blueprint* and pick the repo (uses `render.yaml`), **or** *New → Web Service* with: root directory `server`, build `npm install`, start `npm start`, health check path `/api/health`.
3. Environment: `MONGO_URI` (from Atlas), `JWT_SECRET` (random), `NODE_ENV=production`, and `CLIENT_ORIGIN` (fill it after step 3; you can put a placeholder first).
4. Deploy. Check `https://<your-service>.onrender.com/api/health` → `{"ok":true}`.

### 3. Client on Vercel
1. Vercel → *Add New Project* → the same repo, **Root Directory: `client`**.
2. Environment variable: `NEXT_PUBLIC_API_URL=https://<your-service>.onrender.com`
3. Deploy, copy the production URL (e.g. `https://pulse-chat.vercel.app`).

### 4. Connect them
On Render set `CLIENT_ORIGIN=https://pulse-chat.vercel.app` (exact origin, no trailing slash; comma-separate to allow more, e.g. a custom domain) and redeploy. If the browser shows "Connection blocked" or CORS errors, this value is almost always the cause.

Vercel *preview* deployments have different URLs; add them to `CLIENT_ORIGIN` if you want to test with previews.

## Known limitations
- **Render free tier sleeps** after ~15 min idle; the first request takes 30-60 s. The app shows "Can't reach the server → Try again" / "Reconnecting…" meanwhile and recovers by itself.
- **Token in `localStorage`:** simple and works across the Vercel/Render domains, but an XSS bug could steal it. React escapes output, but if you add rich text/markdown/HTML, sanitize it. JWTs are valid 7 days and can't be revoked (no logout-everywhere).
- **Public rooms broadcast to every connected user** (so sidebars can show unread counts). Fine for a demo; at scale you'd move to per-room subscriptions.
- Single server instance: presence and broadcast live in memory. Running several instances needs a pub/sub layer (e.g. Redis).
- Not included: image upload, email verification, password reset, OAuth, push notifications, message search, automated frontend tests.
- Rate limits: auth endpoints 10 req/min/IP; each WebSocket 100 events / 10 s. Behind a proxy, `trust proxy` is set to 1 hop.
