import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

// Runs on the workers pool against a real Durable Object (TestChat in
// ../do/fixture.workers.ts, bound as TEST_WS) that accepts sockets with
// ctx.acceptWebSocket and answers in its webSocketMessage handler.
async function connect(room: string, name: string, roomTag = room) {
	const res = await env.TEST_WS.getByName(room).fetch(
		`https://chat/?room=${roomTag}&name=${name}`,
		{ headers: { Upgrade: 'websocket' } }
	)
	expect(res.status).toBe(101)
	const ws = res.webSocket as WebSocket
	ws.accept()
	const messages: unknown[] = []
	ws.addEventListener('message', (e) => {
		messages.push(JSON.parse(e.data as string))
	})
	const next = async (count: number) => {
		await expect.poll(() => messages.length).toBeGreaterThanOrEqual(count)
		return messages[count - 1]
	}
	return { ws, next }
}

describe('ws module (workers pool)', () => {
	it('upgrades, keeps the attachment, and broadcasts to the room but not the sender', async () => {
		const ada = await connect('r1', 'ada')
		const bob = await connect('r1', 'bob')

		ada.ws.send(JSON.stringify({ text: 'hi', room: 'r1' }))
		expect(await ada.next(1)).toEqual({ ack: 1 })
		expect(await bob.next(1)).toEqual({ from: 'ada', text: 'hi' })
	})

	it('filters the broadcast by tag', async () => {
		const ada = await connect('r2', 'ada', 'red')
		await connect('r2', 'bob', 'blue')

		ada.ws.send(JSON.stringify({ text: 'hi', room: 'blue' }))
		expect(await ada.next(1)).toEqual({ ack: 1 })
		ada.ws.send(JSON.stringify({ text: 'hi', room: 'green' }))
		expect(await ada.next(2)).toEqual({ ack: 0 })
	})

	it('reports an invalid message as WS_INVALID_MESSAGE', async () => {
		const ada = await connect('r3', 'ada')
		ada.ws.send('not json')
		expect(await ada.next(1)).toEqual({ error: 'WS_INVALID_MESSAGE' })
	})

	it('rejects a request without an Upgrade header', async () => {
		await expect(env.TEST_WS.getByName('r4').fetch('https://chat/')).rejects.toThrow(
			'Expected a WebSocket upgrade'
		)
	})
})
