import { CloudflareError } from '../errors/index.js'
import type { SchemaLike } from '../request/index.js'

/**
 * Helpers for the Hibernatable WebSockets API on a Durable Object: accept an
 * upgrade with `ctx.acceptWebSocket`, keep typed per-socket state in its
 * attachment, and read and write JSON messages in the `webSocketMessage` /
 * `webSocketClose` handlers. Plain functions over `ctx` and `WebSocket`, so they
 * work with `BaseDurableObject` or the stock `DurableObject`.
 */

/** Options for {@link acceptWebSocket}. */
export interface AcceptWebSocketOptions<A> {
	/** Tags for `ctx.getWebSockets(tag)` (at most 10, each at most 256 characters). */
	tags?: string[]
	/** Per-socket state that survives hibernation. Read it back with {@link getAttachment}. */
	attachment?: A
}

/**
 * Accept a WebSocket upgrade on a Durable Object with the hibernation API and
 * return the `101` response for its `fetch` handler. A request without an
 * `Upgrade: websocket` header throws an exposed `426` with code
 * `WS_UPGRADE_REQUIRED`.
 *
 * @example
 * async fetch(request: Request) {
 *   return acceptWebSocket(request, this.ctx, { tags: ['lobby'], attachment: { name: 'ada' } })
 * }
 */
export function acceptWebSocket<A = unknown>(
	request: Request,
	ctx: DurableObjectState,
	options: AcceptWebSocketOptions<A> = {}
): Response {
	if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
		throw new CloudflareError('Expected a WebSocket upgrade', {
			status: 426,
			code: 'WS_UPGRADE_REQUIRED',
		})
	}
	const { 0: client, 1: server } = new WebSocketPair()
	ctx.acceptWebSocket(server, options.tags)
	if (options.attachment !== undefined) server.serializeAttachment(options.attachment)
	return new Response(null, { status: 101, webSocket: client })
}

/**
 * Read a socket's attachment, typed as `A`, or `null` if none was set. The type
 * is asserted, not validated.
 */
export function getAttachment<A>(ws: WebSocket): A | null {
	return (ws.deserializeAttachment() as A | undefined) ?? null
}

/**
 * Replace a socket's attachment. It is stored with structured clone, and the
 * runtime caps its serialized size (it throws past that), so keep it small.
 */
export function setAttachment<A>(ws: WebSocket, attachment: A): void {
	ws.serializeAttachment(attachment)
}

/**
 * Parse a `webSocketMessage` payload as JSON and validate it with `schema` (any
 * object with `parse(input): T`, such as a Zod schema). Binary messages are
 * decoded as UTF-8 first. Malformed JSON or a failed parse throws an exposed
 * `400` with code `WS_INVALID_MESSAGE`; the handler isn't wrapped by
 * `defineFetch`, so catch it and reply or close the socket yourself.
 *
 * @example
 * async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
 *   const msg = parseMessage(message, ChatMessage)
 * }
 */
export function parseMessage<T>(message: string | ArrayBuffer, schema: SchemaLike<T>): T {
	let raw: unknown
	try {
		raw = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message))
	} catch (cause) {
		throw new CloudflareError('Invalid JSON message', {
			status: 400,
			code: 'WS_INVALID_MESSAGE',
			cause,
		})
	}
	try {
		return schema.parse(raw)
	} catch (cause) {
		const msg = cause instanceof Error ? cause.message : 'Message failed validation'
		throw new CloudflareError(msg, { status: 400, code: 'WS_INVALID_MESSAGE', cause })
	}
}

/** Send `data` to one socket as a JSON text message. */
export function sendMessage<T>(ws: WebSocket, data: T): void {
	ws.send(JSON.stringify(data))
}

/** Options for {@link broadcast}. */
export interface BroadcastOptions {
	/** Only send to sockets accepted with this tag. */
	tag?: string
	/** Skip this socket, typically the sender. */
	except?: WebSocket
}

/**
 * Send `data` as JSON to every socket the Durable Object has accepted (or only
 * those with `tag`). The payload is serialized once. A socket that throws on
 * `send` (already closing) is skipped. Returns how many sockets it was sent to.
 *
 * @example
 * broadcast(this.ctx, { type: 'joined', name }, { tag: 'lobby', except: ws })
 */
export function broadcast<T>(
	ctx: DurableObjectState,
	data: T,
	options: BroadcastOptions = {}
): number {
	const payload = JSON.stringify(data)
	let sent = 0
	for (const ws of ctx.getWebSockets(options.tag)) {
		if (ws === options.except) continue
		try {
			ws.send(payload)
			sent++
		} catch {
			// Closing or closed between getWebSockets and send; its webSocketClose still fires.
		}
	}
	return sent
}
