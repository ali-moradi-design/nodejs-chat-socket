# nodejs-chat-socket

Production-minded realtime chat backend built with **Node.js**, **Express**, **Socket.IO**, and **TypeScript**.

Companion frontend: [nodejs-chat-web](https://github.com/ali-moradi-design/nodejs-chat-web).

## Features

- Multi-user rooms (default `general` + create/join)
- Guest auth via Socket.IO handshake (`displayName` + optional stable `userId` UUID)
- Message history with JSON file persistence (survives restarts)
- Events: `message:send`, `message:new`, `message:history`, `room:join/leave/list/create`, `typing:start/stop`, `presence:update`, `error`, `auth:ok`
- Presence per room, typing indicators
- Client `clientMsgId` idempotent dedupe + ACK with server `id` + `createdAt`
- Cursor history via `afterId` / `beforeId` (reconnect-friendly, no flood)
- REST: `GET /health`, `GET /api/rooms`, `GET /api/rooms/:id/messages`

## Hardening

| Concern | Mitigation |
| --- | --- |
| CORS | Allowlist via `CORS_ORIGINS` |
| Abuse | Per-socket message rate limit (token bucket) |
| XSS | Store plain text only; strip control chars; client escapes |
| Length | `MAX_MESSAGE_LENGTH` (default 4000) |
| Auth | Zod handshake validation; disconnect on invalid |
| Headers | Helmet on HTTP |
| Input | Zod schemas on all socket + REST payloads |
| Presence | Cleanup on disconnect / multi-tab aware |

See [SECURITY.md](./SECURITY.md) for the threat model and production checklist.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Server listens on `http://localhost:3001` by default.

```bash
npm run build && npm start   # production
npm test                     # vitest
npm run typecheck
```

## Socket handshake

```ts
io('http://localhost:3001', {
  auth: {
    displayName: 'Ali',
    userId: localStorage.getItem('chatUserId') ?? undefined, // optional UUID
  },
});
```

On success the server emits `auth:ok` with `{ userId, displayName }` and auto-joins `general`.

### `message:send` → ACK

```ts
socket.emit('message:send', { roomId, text, clientMsgId }, (ack) => {
  // ack: { ok: true, id, clientMsgId, createdAt } | { ok: false, error }
});
```

### History (resync)

```ts
socket.emit('message:history', { roomId, afterId, limit: 50 }, (res) => {
  // res.messages — only messages after afterId
});
```

## Environment

See `.env.example`. Important vars:

- `PORT`, `HOST`
- `CORS_ORIGINS` — comma-separated origins (required in production)
- `RATE_LIMIT_PER_SEC`, `MAX_MESSAGE_LENGTH`
- `PERSISTENCE_PATH` — JSON store path

## License

MIT
