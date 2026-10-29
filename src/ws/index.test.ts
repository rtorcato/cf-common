import { describe, expect, it, vi } from 'vitest'
import {
	acceptWebSocket,
	broadcast,
	getAttachment,
	parseMessage,
	sendMessage,
	setAttachment,
} from './index'

const schema = {
	parse(input: unknown) {
		const msg = input as { text?: unknown }
		if (typeof msg?.text !== 'string') throw new Error('text must be a string')
		return { text: msg.text }
	},
}

const socket = (send = vi.fn()) => {
	let attachment: unknown = null
	return {
		send,
		serializeAttachment: vi.fn((a: unknown) => {
			attachment = a
		}),
		deserializeAttachment: () => attachment,
	} as unknown as WebSocket & { send: ReturnType<typeof vi.fn> }
}

const ctxWith = (sockets: WebSocket[]) =>
	({ getWebSockets: vi.fn(() => sockets) }) as unknown as DurableObjectState

describe('ws module', () => {
	it('acceptWebSocket rejects a request without an Upgrade: websocket header', () => {
		const ctx = { acceptWebSocket: vi.fn() } as unknown as DurableObjectState
		expect(() => acceptWebSocket(new Request('https://x/'), ctx)).toThrow(
			expect.objectContaining({ status: 426, expose: true, code: 'WS_UPGRADE_REQUIRED' })
		)
		expect(ctx.acceptWebSocket).not.toHaveBeenCalled()
	})

	it('getAttachment returns null before setAttachment, then the value', () => {
		const ws = socket()
		expect(getAttachment<{ name: string }>(ws)).toBeNull()
		setAttachment(ws, { name: 'ada' })
		expect(getAttachment<{ name: string }>(ws)).toEqual({ name: 'ada' })
	})

	it('parseMessage parses and validates text and binary messages', () => {
		expect(parseMessage('{"text":"hi"}', schema)).toEqual({ text: 'hi' })
		const bytes = new TextEncoder().encode('{"text":"héllo"}')
		expect(parseMessage(bytes.buffer as ArrayBuffer, schema)).toEqual({ text: 'héllo' })
	})

	it.each([
		['malformed JSON', 'not json', 'Invalid JSON message'],
		['a failed parse', '{"text":1}', 'text must be a string'],
	])('parseMessage throws an exposed 400 on %s', (_, message, text) => {
		expect(() => parseMessage(message, schema)).toThrow(
			expect.objectContaining({
				message: text,
				status: 400,
				expose: true,
				code: 'WS_INVALID_MESSAGE',
			})
		)
	})

	it('sendMessage sends JSON text', () => {
		const ws = socket()
		sendMessage(ws, { text: 'hi' })
		expect(ws.send).toHaveBeenCalledWith('{"text":"hi"}')
	})

	it('broadcast sends to every socket but the excluded one, filtered by tag', () => {
		const [a, b, c] = [socket(), socket(), socket()]
		const ctx = ctxWith([a, b, c])
		expect(broadcast(ctx, { text: 'hi' }, { tag: 'lobby', except: b })).toBe(2)
		expect(ctx.getWebSockets).toHaveBeenCalledWith('lobby')
		expect(a.send).toHaveBeenCalledWith('{"text":"hi"}')
		expect(b.send).not.toHaveBeenCalled()
		expect(c.send).toHaveBeenCalledWith('{"text":"hi"}')
	})

	it('broadcast skips a socket that throws on send', () => {
		const closing = socket(
			vi.fn(() => {
				throw new TypeError('WebSocket is closing')
			})
		)
		const open = socket()
		expect(broadcast(ctxWith([closing, open]), { text: 'hi' })).toBe(1)
		expect(open.send).toHaveBeenCalledOnce()
	})
})
