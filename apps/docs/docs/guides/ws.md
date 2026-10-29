---
title: ws
description: Hibernatable WebSocket helpers for Durable Objects.
---

`@rtorcato/cf-common/ws` wraps the Hibernatable WebSockets API on a Durable
Object. Cloudflare can evict a hibernating object from memory while its sockets
stay open, and wake it again for the next message, so you don't pay for idle
connections. These helpers cover the parts every such object repeats: accepting
the upgrade, keeping typed per-socket state, and reading and writing JSON.

```ts
import { BaseDurableObject } from '@rtorcato/cf-common/do'
import {
  acceptWebSocket,
  broadcast,
  getAttachment,
  parseMessage,
  sendMessage,
} from '@rtorcato/cf-common/ws'
import { isCloudflareError } from '@rtorcato/cf-common/errors'
import { z } from 'zod'

const ChatMessage = z.object({ text: z.string().max(1000) })
interface Member { name: string }

export class ChatRoom extends BaseDurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const name = new URL(request.url).searchParams.get('name') ?? 'anon'
    return acceptWebSocket<Member>(request, this.ctx, { attachment: { name } })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const { text } = parseMessage(message, ChatMessage)
      const from = getAttachment<Member>(ws)?.name
      broadcast(this.ctx, { from, text }, { except: ws })
    } catch (e) {
      if (!isCloudflareError(e)) throw e
      sendMessage(ws, { error: e.code })
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    broadcast(this.ctx, { left: getAttachment<Member>(ws)?.name })
  }
}
```

Route the upgrade from your Worker to the object as usual:

```ts
export default {
  fetch: (request, env) => env.CHAT.getByName('lobby').fetch(request),
} satisfies ExportedHandler<Env>
```

## Exports

| Call | Does |
| --- | --- |
| `acceptWebSocket(request, ctx, { tags?, attachment? })` | Creates a `WebSocketPair`, calls `ctx.acceptWebSocket(server, tags)`, stores `attachment`, and returns the `101` response with the client end |
| `getAttachment<A>(ws)` | The socket's attachment typed as `A`, or `null` if none was set |
| `setAttachment(ws, value)` | Replaces the attachment |
| `parseMessage(message, schema)` | `JSON.parse` (a binary message is decoded as UTF-8 first), then `schema.parse` |
| `sendMessage(ws, data)` | `ws.send(JSON.stringify(data))` |
| `broadcast(ctx, data, { tag?, except? })` | Sends `data` as JSON to every accepted socket, or only those with `tag`, skipping `except`. Returns how many it sent to |

## Errors

| Code | Status | When |
| --- | --- | --- |
| `WS_UPGRADE_REQUIRED` | 426 (exposed) | The request has no `Upgrade: websocket` header |
| `WS_INVALID_MESSAGE` | 400 (exposed) | The message isn't JSON, or `schema.parse` threw |

`webSocketMessage` and `webSocketClose` aren't wrapped by `defineFetch`, so a
`WS_INVALID_MESSAGE` there won't become a response. Catch it and reply, or close
the socket with `ws.close(1007, 'invalid message')`.

## Good to know

- Tags are fixed when the socket is accepted: at most 10 per socket, each at
  most 256 characters. Use them to group sockets (a room, a user) for
  `ctx.getWebSockets(tag)` and `broadcast`'s `tag`.
- The attachment is the only per-socket state that survives hibernation, since
  fields on `this` are lost when the object is evicted. It is stored with
  structured clone and its size is capped, so keep it small. The type is
  asserted, not validated.
- `broadcast` skips a socket that throws on `send` (it was closing); its
  `webSocketClose` still runs.
- For keep-alive pings that shouldn't wake the object, use the runtime's
  `ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))`.
- The `ws` subpath doesn't import `cloudflare:workers`, so it also loads in
  plain Node, but the WebSocket APIs it calls only exist under workerd.

See the [`ws` API reference](/docs/api/ws) for every export.
