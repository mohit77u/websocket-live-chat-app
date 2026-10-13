# PLAN: Implementation (based on SPEC.md)

Decisions locked: Next.js `:3000`, Express `:4000`, room name URL mein (`/chat/[room]`).

## Status
- [x] Task 1: Backend (`server/index.js`) — done and tested
- [x] Task 2–6: done (cleanup, Next.js client, pages, README, e2e verified)

---

## Task 1: Backend — DONE
Express + ws + mongoose. Covers F2–F6, F8. Tested with 2 WS clients and REST history.

**Small follow-ups (Task 2):**
- Next.js `:3000` se calls aati hain, `cors()` already enabled hai (no change needed)
- Server pe `PORT`/`MONGO_URI` env support already hai, `.env.example` add karna hai

## Task 2: Backend cleanup (small)
- `server/.env.example` add (`PORT=4000`, `MONGO_URI=...`)
- `server/package.json` mein `start` script confirm karna (`node index.js`)
- **Verify:** `npm start` se server up hota hai, "MongoDB connected" log aata hai

## Task 3: Replace Vite client with Next.js
- Purana `client/` (Vite) delete karna
- `npx create-next-app@latest client` (App Router, JS, no Tailwind, no ESLint, no src dir)
- **Verify:** `cd client && npm run dev` pe default page `localhost:3000` pe khulta hai

## Task 4: Frontend pages
Files:
| File | Kaam |
|------|------|
| `client/lib/config.js` | `API_URL`, `WS_URL` (env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, default localhost:4000) |
| `client/app/page.js` | Join screen: name + room input, submit par `/chat/<room>?user=<name>` pe redirect (F1) |
| `client/app/chat/[room]/page.js` | Server wrapper jo room param pass karta hai |
| `client/app/chat/[room]/Chat.js` | `"use client"` component: history fetch (F2), WebSocket (F3, F5, F6, F7), send, auto-scroll |
| `client/app/globals.css` | Purani `App.css` ki styling reuse |

Notes:
- WebSocket `useEffect` mein bane, cleanup mein `ws.close()` (React strict mode double-mount safe)
- User name query param se aata hai. Agar missing ho to join screen pe wapas redirect
- Room name `decodeURIComponent` aur `encodeURIComponent` se handle karna

**Verify:** `npm run build` pass hota hai, aur dev server pe join -> chat page khulta hai

## Task 5: README update
- Run steps (3 terminals ya 2: server, client), env vars, event flow short mein

## Task 6: End-to-end verification (SPEC ke acceptance criteria)
Playwright ya manual se, 2 tabs:
1. Join screen `localhost:3000` pe khulti hai
2. Same room, 2 tabs: message turant dusre tab mein dikhta hai
3. Refresh ke baad history wapas aati hai
4. Alag room ke tabs ko messages nahi milte
5. Tab close karne par online list update hoti hai
6. MongoDB band hone par server error ke saath exit hota hai (server start pe check)

Result report mein har criterion ke saath pass/fail likhunga.

---

## Order of execution
Task 2 -> 3 -> 4 -> 5 -> 6. Har task ke baad uska verify chalega, tabhi aage badhenge.

## Risks
| Risk | Mitigation |
|------|-----------|
| React strict mode mein WebSocket do baar connect hota hai | cleanup mein close, dev mein sirf ek stray connection, harmless |
| `create-next-app` interactive prompt pe atak sakta hai (pehle bhi interrupt hua tha) | saare flags explicitly dena, background mein chalana |
| Next.js version ke App Router conventions alag ho sakte hain | generated project dekh ke hi files likhunga |
