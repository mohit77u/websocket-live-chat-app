# SPEC: Real-time Chat Demo (Next.js + Express + WebSocket + MongoDB)

## 1. Goal
WebSocket seekhne ke liye ek chhota real-time chat app. Isse ye cover hona chahiye:
- persistent WebSocket connection (browser <-> Express server)
- REST API se data fetch (chat history)
- MongoDB mein data persistence
- room-based broadcast

Ye demo hai, production app nahi. Scope chhota rakhna hai.

## 2. Tech Stack
| Layer | Choice |
|-------|--------|
| Frontend | Next.js (App Router, JavaScript, no Tailwind) |
| Backend | Node.js + Express |
| Realtime | `ws` library (raw WebSocket) |
| Database | MongoDB (local, `mongodb://127.0.0.1:27017/ws_chat_demo`) via mongoose |

## 3. Functional Requirements
| ID | Requirement |
|----|-------------|
| F1 | User ek name aur room name daal ke join karta hai (no auth/password) |
| F2 | Join karne par us room ki last 50 messages REST API se load hoti hain |
| F3 | User message bhejta hai, to wo us room ke sabhi connected clients ko real-time milta hai |
| F4 | Har message MongoDB mein save hota hai (room, user, text, createdAt) |
| F5 | Room mein online users ki list dikhti hai aur join/leave par update hoti hai |
| F6 | "X is typing..." indicator dikhta hai (sirf dusre users ko) |
| F7 | Connection status (connected/disconnected) UI mein dikhta hai |
| F8 | Dusre room ke messages cross-leak nahi hone chahiye |

## 4. Non-Functional / Constraints
- Message max 500 chars, username max 30 chars, empty message reject
- Invalid JSON ya unknown event type par server crash nahi hona chahiye (ignore)
- Sab kuch localhost pe chalega, deployment scope se bahar
- Config env se: `MONGO_URI`, `PORT` (defaults hain)

## 5. Architecture
```
Next.js (:3000)  --REST GET /api/messages/:room-->  Express (:4000)  --> MongoDB
       \---------WebSocket ws://localhost:4000-------/
```
- Express aur `ws` ek hi HTTP server (port 4000) share karte hain
- Next.js sirf UI hai. Isme koi API route ya DB access nahi
- Chat page client component hoga (`"use client"`), kyunki WebSocket sirf browser mein chalta hai

## 6. API Contract

### REST
`GET /api/messages/:room`
- Response: array of messages, oldest -> newest, max 50
```json
[{ "_id": "...", "room": "general", "user": "Mohit", "text": "hi", "createdAt": "ISO date" }]
```

### WebSocket events (JSON)
Client -> Server:
| type | payload | Effect |
|------|---------|--------|
| `join` | `{ user, room }` | socket ko room se attach karta hai, online list broadcast hoti hai |
| `message` | `{ text }` | DB mein save, phir room ko broadcast |
| `typing` | `{}` | room ke baaki users ko forward |

Server -> Client:
| type | payload |
|------|---------|
| `message` | `{ message: <saved doc> }` |
| `online` | `{ users: string[] }` |
| `typing` | `{ user }` |

## 7. Data Model
`Message` collection: `room` (String, indexed), `user` (String), `text` (String), `createdAt` (Date, default now)

## 8. Folder Structure
```
mern-websocket-chat/
  SPEC.md
  PLAN.md            (next step)
  README.md
  server/            Express + ws + mongoose (index.js)
  client/            Next.js app
    app/page.js      join screen
    app/chat/...     chat UI (client component)
```

## 9. Current State
- `server/index.js` bana hua hai, F2-F8 ke liye tested hai (2 WS clients ne message bheja, MongoDB mein save hua, REST se wapas mila)
- `client/` abhi Vite + React hai. Isse Next.js se replace karna hai

## 10. Out of Scope
Authentication, private/DM chat, file upload, message edit/delete, reconnect/heartbeat, deployment, automated tests.
Ye agle step ke ideas ho sakte hain.

## 11. Acceptance Criteria
1. `server` aur `client` dono start hone par `localhost:3000` pe join screen khulti hai
2. Do browser tabs mein same room join karo. Ek se bheja message dusre mein turant dikhta hai
3. Page refresh ke baad purani messages wapas aati hain (MongoDB se)
4. Alag room ke tabs ko ek-dusre ke messages nahi milte
5. Tab close karne par online list se naam hat jata hai
6. MongoDB band hone par server clear error ke saath exit hota hai

## 12. Open Questions
1. Next.js ko `localhost:3000` pe aur Express ko `4000` pe rakhein? (default: haan)
2. Room name URL mein chahiye (`/chat/general`) ya sirf state mein? (default: URL mein, taaki link share ho sake)
