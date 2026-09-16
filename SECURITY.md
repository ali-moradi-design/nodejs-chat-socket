# Security notes

## Threat model (guest chat)

- Anyone with the URL can connect with an arbitrary display name.
- Display names and message bodies are **untrusted**. Store and render as plain text only.
- No authorization between rooms — knowledge of a room id is enough to join.

## Mitigations in this service

- CORS allowlist via `CORS_ORIGINS` (do not use `*` in production).
- Helmet HTTP headers.
- Zod validation on handshake + all socket/REST payloads.
- Control-character stripping + max message length.
- Per-socket message rate limit (token bucket).
- Idempotent `clientMsgId` dedupe.
- JSON persistence path should not be world-writable.

## Production checklist

1. Terminate TLS at a reverse proxy.
2. Set a tight `CORS_ORIGINS`.
3. Restrict filesystem permissions on `PERSISTENCE_PATH`.
4. Consider IP-based rate limits / WAF in front of Node.
5. Monitor `/health` and disconnect storms.
6. Do not log full message bodies in shared logs if content is sensitive.
