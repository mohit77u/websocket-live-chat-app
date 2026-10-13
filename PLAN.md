# PLAN v2: Implementation (based on SPEC.md v2)

Decisions locked (SPEC §12 defaults): koi bhi logged-in user room bana sakta hai, sab rooms public, JWT `localStorage` mein, UI khud Tailwind se.

## Status
- [x] v1 demo done (`docs/`)
- [x] Task 0-10: done (setup, server, auth, REST, WS hub, server verify, client foundation, auth pages, shell, chat view, polish)
- [x] Task 11: end-to-end verification done (see results in the final report; items not covered are listed there)
- [x] Task 12: deploy prep done (README, env examples, render.yaml). Nothing committed or deployed.

## Important notes pehle
- **DB naya hoga:** v1 ka `Message` schema (`room` string) v2 se incompatible hai. v2 naya DB `ws_chat` use karega (`ws_chat_demo` ko haath nahi lagayenge).
- **Server restructure:** `server/index.js` (single file) ki jagah `server/src/...` structure. Purani `index.js` last mein hatayenge, jab naya server chal jaye.
- **Testing ki limit:** Playwright browser ke ek context mein saare tabs `localStorage` share karte hain, to 2 tabs = same user. Dusre user ke liye ya to alag isolated context banayenge, ya ek Node script (`ws` + REST) dusre user ki tarah chalayenge. Task 5 aur 11 mein yehi approach hai.
- **Commits:** git repo banega (Task 0) par main commit/push tab karunga jab tum bologe.

---

## Task 0: Project hygiene
- Root pe `git init`, `.gitignore` (`node_modules`, `.env`, `.next`, `.playwright-mcp`)
- `client/` ke andar `create-next-app` ne jo nested `.git` banaya hai use hatana (nahi to root repo mein submodule jaisa behave karega)
- **Verify:** `git status` mein `node_modules` aur `.env` nahi dikhte

## Task 1: Server foundation
Dependencies add: `helmet`, `express-rate-limit`, `zod`, `jsonwebtoken`, `bcryptjs`
Files:
| File | Kaam |
|------|------|
| `src/config.js` | env padhna + validate (`MONGO_URI`, `JWT_SECRET` required in production, `CLIENT_ORIGIN`, `PORT`). Production mein `JWT_SECRET` missing ho to crash |
| `src/db.js` | mongoose connect |
| `src/models/{User,Conversation,Message,ReadState}.js` | SPEC §6 ke hisaab se, indexes ke saath (`Message: {conversation, createdAt}`, `Conversation.name` unique sparse, DM ke liye `members` sorted-pair unique key) |
| `src/app.js` | express app: helmet, cors (allow-list), json, `/api/health`, error handler |
| `src/index.js` | http server banana, db connect, `general` room seed (idempotent) |
- `package.json`: `"main": "src/index.js"`, `start`, `dev` (`node --watch`)
- `.env.example` update
- **Verify:** server start hota hai, `GET /api/health` -> 200, restart par `general` duplicate nahi banta

## Task 2: Auth (REST)
- `src/routes/auth.js`: `POST /auth/signup`, `POST /auth/login`, rate limit 10/min/IP
- `src/middleware/auth.js`: Bearer JWT verify -> `req.user`; `GET /api/me`
- `src/middleware/validate.js`: zod wrapper (400 + field errors)
- Rules: username `^[a-z0-9_]{3,20}$` (lowercase me store), email lowercase, password min 8, duplicate par 409 (generic message, kaunsa field alag se batate hain: username/email taken)
- Response kabhi `passwordHash` nahi
- **Verify (curl):** signup ok, duplicate 409, galat password 401, bina token `/me` 401, DB mein hash bcrypt format ($2...), 11th request/min 429

## Task 3: Conversations REST
`src/routes/conversations.js`, `src/routes/users.js`
| Endpoint | Rule |
|----------|------|
| `GET /conversations` | public rooms (sab) + mere DMs; har ek ke saath `unreadCount`, `lastMessage`, DM mein `otherUser` |
| `POST /rooms` | name 3-30 chars, unique (409) |
| `POST /dms` `{username}` | existing DM return ya naya; khud ke saath DM nahi (400); user nahi mila (404) |
| `GET /users?q=` | prefix search, max 10, khud ko exclude |
| `GET /conversations/:id/messages` | `before` (pagination, limit 50) ya `after` (catch-up, limit 200); **DM mein non-member ko 403** |
| `POST /conversations/:id/read` | `lastReadAt = now` |
- Message JSON shape (sab jagah same): `{id, conversation, sender:{id,username}, text, reactions:[{emoji,users:[userId]}], editedAt, deletedAt, createdAt}`. Deleted message mein `text` empty bhejna (content leak nahi)
- **Verify (curl, 2-3 users):** pagination 50+ messages pe sahi, teesre user ko DM 403, unread count sahi

## Task 4: WebSocket hub
`src/ws/hub.js` (connections + presence + broadcast), `src/ws/handlers.js` (events)

**Connection lifecycle**
- Connect -> 5s timer; pehla message `{type:"auth", token}` hona chahiye warna close(4001)
- Valid -> `{type:"auth.ok", user}`; invalid -> close(4001)
- Ping har 30s, `isAlive` flag, pong na aaye to `terminate()`
- `userId -> Set<socket>` map. Presence: user ka pehla socket khulte hi `presence {userId, online:true}`, aakhri band hote hi `online:false` (sab authenticated clients ko)

**Events (Client -> Server)** (sab zod se validated, invalid ignore)
| Event | Payload | Server action |
|-------|---------|---------------|
| `message.send` | `{conversationId, text}` (1-1000 chars) | membership check (DM), save, `message.new` ko conversation ke audience ko bhejna |
| `message.edit` | `{messageId, text}` | sirf sender, deleted nahi, `editedAt` set, `message.updated` |
| `message.delete` | `{messageId}` | sirf sender, soft delete (`deletedAt`, text clear), `message.updated` |
| `reaction.toggle` | `{messageId, emoji}` | emoji allowed set mein, user add/remove, `message.updated` |
| `typing` | `{conversationId}` | audience ko (sender chhodke) `typing {conversationId, userId, username}` |

**Server -> Client:** `auth.ok`, `message.new {message}`, `message.updated {message}`, `typing`, `presence`, aur online users ka initial snapshot `presence.snapshot {userIds}` auth ke turant baad

**Audience rule:** public room -> sab authenticated users (simple; unread ke liye sidebar ko sab rooms ke events chahiye). DM -> sirf 2 members.
- Rejected action par `{type:"error", code, ref}` (client toast dikha sakta hai)
- **Verify:** Task 5 mein

## Task 5: Server verification script
`server/scripts/verify.js` (Node script, `ws` + `fetch`, 3 users A, B, C) jo SPEC criteria 1, 3, 5, 6, 7(catch-up part) check kare:
1. Bina token WS 5s mein close
2. A ka message B ko turant mile
3. B, A ka message edit/delete kare -> reject (error event), A khud kare -> B ko `message.updated`
4. Reaction toggle on/off
5. A-B DM: C ko REST 403 aur WS pe event nahi aata
6. Ping/pong: pong band karke connection terminate hota hai (ya at least ping frames aate hain)
7. `after=` se missed messages milte hain
- Output: har check ke saath PASS/FAIL, ant mein summary. Ye script repo mein rahegi (dev tool)
- **Gate:** sab PASS hone par hi client ka kaam shuru

## Task 6: Client foundation
- Tailwind v4: `tailwindcss`, `@tailwindcss/postcss`, `postcss.config.mjs`; `next-themes`, `lucide-react`
- `globals.css`: design tokens (CSS variables) light + dark, `dark` class strategy
- `lib/config.js` (env), `lib/api.js` (fetch wrapper: Bearer token, 401 par logout), `lib/auth.js` (AuthProvider: user, token, login, signup, logout; localStorage safe wrapper)
- `lib/socket.js` (**core**): ek WebSocket manager
  - connect -> `auth` message -> `auth.ok`
  - reconnect exponential backoff 1s->30s, jitter
  - status: `connecting | online | reconnecting`
  - subscribe API: `on(type, handler)` -> unsubscribe fn, `send(event)`
  - reconnect ke baad `onReconnect` callback (catch-up ke liye)
  - Strict Mode double-mount safe (ek hi socket)
- `components/Providers.js` (Theme + Auth + Socket + Toast)
- **Verify:** `npm run build` pass

## Task 7: Auth pages
- `/login`, `/signup`: validated form (inline errors, server errors), loading state, links ek dusre pe
- `/` : logged in -> `/chat`, nahi -> `/login`
- Auth guard: `app/chat/layout.js` client-side check; token hai par `/me` fail to logout
- **Verify (browser):** signup -> chat, galat password error, protected route redirect, refresh pe session bacha rehta hai

## Task 8: App shell + Sidebar
- `app/chat/layout.js`: sidebar + content area. Mobile (<768px) pe drawer + hamburger
- `Sidebar`: user card + theme toggle + logout; Rooms section (+ create room modal); DMs section (+ user search -> start DM); har item pe unread badge, DM pe presence dot
- Conversations state (context/store): REST se load, socket events se live update (`message.new` -> lastMessage, unread++ agar active nahi), sorting by `lastMessageAt`
- `components/ui/`: Button, Input, Avatar (initials + hash color), Modal, Skeleton, Toast
- **Verify:** list load hoti hai, room banta hai, DM start hota hai, mobile drawer khulta/band hota hai

## Task 9: Chat view
Route `app/chat/[id]/page.js` (Next 16 rules yaad: `params` Promise hai, runtime data `Suspense` ke andar; v1 ka `chat/[room]/page.js` pattern reuse)
- `MessageList`: initial 50 load, "Load older" (before cursor, scroll position maintain), message grouping, date separators, auto-scroll sirf tab jab user bottom ke paas ho, "new messages" pill warna
- `MessageItem`: hover actions (react, edit, delete) sirf apne messages pe edit/delete; "(edited)", deleted placeholder; reaction chips (count + highlighted agar maine kiya)
- `Composer`: Enter send / Shift+Enter newline, typing event throttle (1 per 2s), char limit counter
- Typing indicator, online members (room header mein), connection banner ("Reconnecting...")
- Reconnect catch-up: `onReconnect` -> `after=<last message createdAt>` se fetch, dedupe by `id`
- Active conversation khulte hi `POST /read` + unread 0
- **Verify:** Task 11 mein

## Task 10: UI polish
- Skeletons (sidebar, messages), empty states ("Koi message nahi, pehla bhejo"), error toasts (WS `error` events, REST failures)
- Dark/light dono mein contrast check, focus states, mobile 375px check
- Page `metadata` (title), favicon
- **Verify:** screenshots light/dark/mobile

## Task 11: End-to-end verification (SPEC ke 11 criteria)
Playwright se: user 1 browser mein, user 2 isolated context ya Node script se.
| # | Criterion | Kaise |
|---|-----------|-------|
| 1 | Signup/login/logout, hash DB mein | browser + `mongosh` |
| 2 | Protected redirect | browser |
| 3 | Bina token WS close | Task 5 script |
| 4 | Do users real-time chat | browser + script |
| 5 | Edit/delete/reaction + ownership reject | browser + Task 5 |
| 6 | DM privacy, 403 | Task 5 + browser |
| 7 | Reconnect: server kill/restart | server process band karke dobara chalana, banner + catch-up dekhna |
| 8 | Theme persist, 375px layout | browser resize + screenshot |
| 9 | Load older (50+ messages) | script se 120 messages seed, browser mein check |
| 10 | Client `npm run build`, server production env se start | commands |
| 11 | README steps | padh ke |
- Report mein har criterion ka PASS/FAIL, jo fail ya untested hoga wo saaf likhunga

## Task 12: Deploy prep
- `README.md` full: local setup, env vars table, architecture short, deploy steps (Atlas -> Render -> Vercel, CORS/`CLIENT_ORIGIN` ordering), known limitations (Render sleep, localStorage XSS tradeoff, free-tier)
- `server/.env.example`, `client/.env.example`
- `render.yaml` (optional blueprint) with `rootDir: server`, healthCheckPath
- Purani `server/index.js` aur v1 client code hatana (v1 `docs/` mein reference ke liye text mein hai)
- Final: `git status` clean-ish, **commit/push nahi** jab tak tum na bolo

---

## Order & gates
`0 -> 1 -> 2 -> 3 -> 4 -> 5 (GATE: server PASS)` -> `6 -> 7 -> 8 -> 9 -> 10 -> 11 (GATE: criteria report)` -> `12`
Har task ke baad uska verify chalega; fail hone par agle task pe nahi jaunga.

## Risks
| Risk | Mitigation |
|------|-----------|
| Next.js 16 ke naye rules (async params, Suspense, Cache Components) | `node_modules/next/dist/docs/` padhunga, v1 ke working pattern reuse |
| Tailwind v4 + Next 16 setup mismatch | Pehle chhota test page build karke dekhna |
| WebSocket reconnect + Strict Mode se duplicate sockets/messages | Single socket manager, message `id` se dedupe |
| 2 users ek browser context mein ek jaise (localStorage) | Isolated context / Node script se dusra user |
| Public rooms ke events sabko jaate hain (bandwidth/privacy) | Demo scope ke liye theek; README mein note. Scale par room-subscription model chahiye |
| Render free sleep + cold start pe WS reconnect | Reconnect backoff + banner already covers |
| Scope bada hai (13 tasks) | Gates pe check-in; chaho to Task 9 ke baad pause karke demo dekh sakte ho |
