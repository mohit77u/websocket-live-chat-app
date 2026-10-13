# SPEC v2: Production-style Chat App (Next.js + Express + WebSocket + MongoDB)

v1 (basic demo) `docs/SPEC-v1.md` mein archived hai aur kaam kar raha hai. v2 usi codebase ko deploy-ready app banata hai.

## 1. Goal
Ek real-time chat app jo deploy karke dikhane layak ho: accounts, rooms, DMs, achha UI, aur stable connection.

## 2. Tech Stack
| Layer | Choice |
|-------|--------|
| Frontend | Next.js 16 (App Router, JS), Tailwind CSS, shadcn/ui-style components, `lucide-react` icons, `next-themes` (dark/light) |
| Backend | Node.js + Express |
| Realtime | `ws` (raw WebSocket) |
| DB | MongoDB (mongoose). Local dev, production mein Atlas |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` |
| Security | `helmet`, `express-rate-limit`, `zod` validation, CORS allow-list |
| Deploy | Vercel (client), Render (server), MongoDB Atlas (DB) |

## 3. Functional Requirements

### Auth
| ID | Requirement |
|----|-------------|
| A1 | Signup: username (unique, 3-20 chars, `a-z0-9_`), email (unique), password (min 8 chars) |
| A2 | Login email+password se; success par JWT (7 din expiry) milta hai |
| A3 | Password bcrypt se hash hota hai, kabhi plain store/return nahi hota |
| A4 | Token browser mein `localStorage` mein; logout par hata diya jata hai |
| A5 | Bina login ke chat pages khulne par `/login` pe redirect |
| A6 | WebSocket connection authenticated hota hai. Bina valid token ke connection close ho jata hai |

### Rooms
| ID | Requirement |
|----|-------------|
| R1 | Logged-in user naya public room bana sakta hai (name unique, 3-30 chars) |
| R2 | Sidebar mein saare public rooms ki list. Click karke join/open |
| R3 | Room mein messages ki history (last 50), "Load older" se aur purane (pagination, cursor = `createdAt`) |
| R4 | Room mein online members ki list |
| R5 | Seed room `general` hamesha rahega |

### Direct Messages
| ID | Requirement |
|----|-------------|
| D1 | Kisi bhi user ko search karke (username) DM start kar sakte hain |
| D2 | DM sirf un 2 users ko dikhta hai, kisi aur ko nahi (server pe check) |
| D3 | Sidebar mein DM conversations ki list, latest message ke hisaab se sorted |
| D4 | Unread count badge har room/DM pe (client-side tracked, last-read DB mein) |

### Messaging
| ID | Requirement |
|----|-------------|
| M1 | Message bhejna: real-time broadcast, MongoDB mein save (max 1000 chars) |
| M2 | Apna message edit kar sakte hain. "(edited)" label dikhta hai |
| M3 | Apna message delete kar sakte hain. Soft delete: "This message was deleted" dikhta hai |
| M4 | Emoji reactions (fixed set: 👍 ❤️ 😂 😮 😢 🎉). Same emoji dobara click karne par hat jata hai |
| M5 | Edit/delete/reaction sabhi ko real-time dikhte hain |
| M6 | Typing indicator ("X is typing...") |
| M7 | Online/offline presence dot users ke naam ke paas |

### Connection
| ID | Requirement |
|----|-------------|
| C1 | Server har 30s mein ping bhejta hai, pong na aaye to connection terminate |
| C2 | Client disconnect hone par auto-reconnect (exponential backoff: 1s, 2s, 4s ... max 30s) |
| C3 | Reconnect ke baad client missed messages fetch karta hai (REST se, last known message ke baad ke) |
| C4 | UI mein connection status banner ("Reconnecting...") |

### UI/UX
| ID | Requirement |
|----|-------------|
| U1 | Dark/light theme toggle, system preference default, choice save hoti hai |
| U2 | Responsive: desktop pe sidebar + chat, mobile pe sidebar drawer |
| U3 | Avatars (username ke initials + deterministic color) |
| U4 | Message grouping (same user ke consecutive messages), date separators, auto-scroll to bottom |
| U5 | Loading skeletons, empty states, error toasts |
| U6 | Login/Signup pages clean aur validated (inline errors) |

## 4. Non-Functional Requirements
- Secrets (`JWT_SECRET`, `MONGO_URI`) sirf env mein, repo mein kabhi nahi. `.env.example` provide hoga
- Server har WS event aur REST body ko `zod` se validate karega. Invalid input crash nahi karega, ignore ya 400
- Auth endpoints par rate limit (10 requests/min/IP)
- Message ownership server pe check hoga (client pe bharosa nahi): sirf author edit/delete kar sakta hai
- CORS sirf `CLIENT_ORIGIN` env se allowed
- Render free tier 15 min inactivity ke baad sleep hota hai (first request ~30-50s slow). Ye known limitation hai, README mein likhenge

## 5. Architecture
```
Browser (Vercel, Next.js)
   | REST (Bearer JWT)            | WebSocket wss:// (JWT in first "auth" message)
   v                              v
        Express + ws (Render)  -->  MongoDB Atlas
```
- WS auth: connection ke baad pehla message `{type:"auth", token}`. 5 sec mein na aaye ya invalid ho to close. (Token URL mein nahi daalte, kyunki URLs logs mein aa jate hain)
- Socket-per-user: ek user ke multiple tabs allowed. Presence "online" tab tak jab tak uska koi bhi socket open ho
- Rooms aur DMs ko ek hi `Conversation` model se handle karenge (`type: "room" | "dm"`), taaki messages ka code ek hi rahe

## 6. Data Models
**User:** `username` (unique), `email` (unique), `passwordHash`, `createdAt`
**Conversation:** `type` (`room`|`dm`), `name` (rooms ke liye, unique), `members` ([userId], DM mein exactly 2), `createdAt`, `lastMessageAt`
**Message:** `conversation` (ref, indexed), `sender` (ref User), `text`, `reactions` ([{emoji, users:[userId]}]), `editedAt`, `deletedAt`, `createdAt`
**ReadState:** `user`, `conversation`, `lastReadAt` (unread count ke liye)

## 7. API Contract

### REST (sab `/api` ke neeche; `Authorization: Bearer <jwt>`, auth endpoints chhodke)
| Method | Path | Kaam |
|--------|------|------|
| POST | `/auth/signup` | account banao, `{token, user}` return |
| POST | `/auth/login` | `{token, user}` return |
| GET | `/me` | current user |
| GET | `/conversations` | meri rooms + DMs (unread count ke saath) |
| POST | `/rooms` | naya public room |
| POST | `/dms` | `{username}` ke saath DM start/return existing |
| GET | `/users?q=` | username search |
| GET | `/conversations/:id/messages?before=<iso>&after=<iso>` | pagination aur reconnect catch-up |
| POST | `/conversations/:id/read` | lastReadAt update |
| GET | `/health` | Render health check |

### WebSocket events (JSON)
Client -> Server: `auth`, `message.send`, `message.edit`, `message.delete`, `reaction.toggle`, `typing`
Server -> Client: `auth.ok`, `message.new`, `message.updated` (edit/delete/reaction teeno), `typing`, `presence`
(Har event ka exact payload `PLAN.md` ke Task mein define hoga)

## 8. Folder Structure (target)
```
mern-websocket-chat/
  SPEC.md  PLAN.md  README.md  docs/ (v1 archive)
  server/
    src/ index.js, config.js, db.js
         models/ (User, Conversation, Message, ReadState)
         routes/ (auth, conversations, users)
         ws/ (hub.js, handlers.js, presence.js)
         middleware/ (auth.js, validate.js)
  client/
    app/ (login, signup, chat/[id], layout)
    components/ (Sidebar, MessageList, MessageItem, Composer, ThemeToggle, ...)
    lib/ (api.js, socket.js, auth.js)
```

## 9. Deployment
- **MongoDB Atlas:** free M0 cluster, DB user, `0.0.0.0/0` network access (Render ke dynamic IPs ki wajah se)
- **Render (server):** Web Service, root dir `server`, start `npm start`, env: `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, health check `/api/health`
- **Vercel (client):** root dir `client`, env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` (`wss://...`)
- Repo `git` mein push karna padega (abhi git repo nahi hai). Deploy khud tum karoge ya main steps ke saath guide karunga. Main tumhare accounts se kuch deploy nahi karunga

## 10. Out of Scope
Image/file upload, email verification, password reset, OAuth (Google login), push notifications, message search, group DMs, end-to-end encryption, automated test suite (sirf manual/browser verification).

## 11. Acceptance Criteria
1. Signup, logout, login kaam karta hai. Galat password par error dikhta hai. DB mein `passwordHash` hai, plain password nahi
2. Bina login ke `/chat/...` kholne par `/login` pe redirect
3. Invalid/bina token ke WebSocket 5s ke andar close hota hai
4. Do alag users (do browser contexts) same room mein real-time chat karte hain
5. Edit, delete, reaction dono users ko turant dikhte hain. Dusre ka message edit/delete karne ki koshish server reject karta hai
6. DM sirf 2 users ko dikhta hai. Teesra user us DM ke messages fetch nahi kar sakta (403)
7. Server band karke dobara chalane par client auto-reconnect karta hai, aur gaye hue messages catch-up se aa jate hain
8. Dark/light toggle kaam karta hai aur refresh ke baad bhi rehta hai. Mobile width (375px) pe layout toot'ta nahi
9. 50 se zyada messages wale room mein "Load older" purane messages laata hai
10. `npm run build` (client) pass, aur server production env vars ke saath start hota hai
11. README mein local setup aur Atlas/Render/Vercel deploy steps hain

## 12. Open Questions (defaults ke saath)
1. Public rooms kaun bana sakta hai? **Default: koi bhi logged-in user**
2. Kya rooms private/invite-only bhi hone chahiye? **Default: nahi, sab rooms public**
3. Token `localStorage` mein (simple, cross-domain pe kaam karta hai) ya httpOnly cookie (zyada secure par Vercel/Render alag domain pe SameSite/CORS ki jhanjhat)? **Default: localStorage, demo ke liye theek hai. XSS risk README mein likhenge**
4. UI components ke liye shadcn/ui CLI use karein ya khud halke components likhein? **Default: khud Tailwind se likhenge (kam dependencies, aur Next.js 16 ke saath CLI conflicts ka risk nahi)**

## 13. Implementation notes (where the final build differs from this spec)
- **WebSocket path** is `/ws` (not the server root). Client derives it from `NEXT_PUBLIC_API_URL`.
- **Pagination cursor** is the message `_id` (`?before=<id>` / `?after=<id>`), not `createdAt`: two messages in the same millisecond would otherwise be skipped.
- **Room names** are normalised to lowercase `[a-z0-9_-]`, 3-30 chars.
- **Presence events** carry usernames (`presence.snapshot` has `users: [{id, username}]` next to `userIds`) so the room header can list who is online.
- **Extra events:** `conversation.new` (new room / new DM shows up live in other users' sidebars) and `error` (rejected action, with optional `ref` echoed back).
- **Reconnect sync (C3):** the client refetches the latest page and merges it, which also picks up edits/deletes/reactions made while offline. `?after=` still exists on the API (and is covered by `npm run verify`). If more than 50 messages were missed, the older loaded list is dropped and "Load older" fills the gap.
- **Per-socket WS rate limit:** 100 events / 10 s. Origin allow-list is also applied to WebSocket connections.
- **Graceful shutdown:** on SIGTERM the server closes every socket with 1001 so clients reconnect immediately.
- **App name** in the UI: "Pulse Chat".
