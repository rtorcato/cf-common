---
'@rtorcato/cf-common': minor
---

Add the `@rtorcato/cf-common/ws` module for Hibernatable WebSockets on a Durable Object: `acceptWebSocket` upgrades with `ctx.acceptWebSocket` (an exposed `426` `WS_UPGRADE_REQUIRED` without an `Upgrade: websocket` header), `getAttachment`/`setAttachment` type the per-socket state, `parseMessage` validates a JSON message (an exposed `400` `WS_INVALID_MESSAGE` on failure), and `sendMessage`/`broadcast` send JSON to one socket or to every socket, optionally by tag.
