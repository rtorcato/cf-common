import { describe, expect, it, vi } from 'vitest'
import { CloudflareError } from '../errors/index'
import { createProducer, defineQueue } from './index'

function fakeQueue(fail = false) {
	const send = vi.fn(async (_body: number, _options?: unknown) => {
		if (fail) throw new Error('boom')
	})
	const sendBatch = vi.fn(async (_messages: unknown[], _options?: unknown) => {
		if (fail) throw new Error('boom')
	})
	return { queue: { send, sendBatch } as unknown as Queue<number>, send, sendBatch }
}

function fakeBatch(bodies: number[], attempts = 1) {
	const messages = bodies.map((body, i) => ({
		id: `m${i}`,
		timestamp: new Date(0),
		body,
		attempts,
		ack: vi.fn(),
		retry: vi.fn(),
	}))
	return { batch: { queue: 'q', messages } as unknown as MessageBatch<number>, messages }
}

const ctx = {} as ExecutionContext

describe('queues producer', () => {
	it('forwards send with options', async () => {
		const { queue, send } = fakeQueue()
		await createProducer(queue).send(1, { delaySeconds: 5 })
		expect(send).toHaveBeenCalledWith(1, { delaySeconds: 5 })
	})

	it('wraps bodies and splits sendBatch into chunks of 100', async () => {
		const { queue, sendBatch } = fakeQueue()
		await createProducer(queue).sendBatch(
			Array.from({ length: 250 }, (_, i) => i),
			{ delaySeconds: 1 }
		)
		expect(sendBatch.mock.calls.map(([chunk]) => chunk.length)).toEqual([100, 100, 50])
		expect(sendBatch.mock.calls[0]).toEqual([
			expect.arrayContaining([{ body: 0 }, { body: 99 }]),
			{ delaySeconds: 1 },
		])
	})

	it('does not call the binding for an empty batch', async () => {
		const { queue, sendBatch } = fakeQueue()
		await createProducer(queue).sendBatch([])
		expect(sendBatch).not.toHaveBeenCalled()
	})

	it('throws a coded CloudflareError when the binding fails', async () => {
		const { queue } = fakeQueue(true)
		const producer = createProducer(queue)
		for (const call of [producer.send(1), producer.sendBatch([1])]) {
			await expect(call).rejects.toMatchObject({
				constructor: CloudflareError,
				code: 'QUEUE_SEND_FAILED',
				status: 502,
			})
		}
	})
})

describe('queues consumer', () => {
	it('acks messages that succeed and retries ones that throw, individually', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {})
		const { batch, messages } = fakeBatch([1, 2, 3])
		await defineQueue<number, object>(async (body) => {
			if (body === 2) throw new Error('bad')
		})(batch, {}, ctx)
		expect(messages.map((m) => [m.ack.mock.calls.length, m.retry.mock.calls.length])).toEqual([
			[1, 0],
			[0, 1],
			[1, 0],
		])
		expect(messages[1]?.retry).toHaveBeenCalledWith(undefined)
	})

	it('passes body, message and env to the handler', async () => {
		const { batch, messages } = fakeBatch([7])
		const handler = vi.fn()
		const env = { a: 1 }
		await defineQueue<number, typeof env>(handler)(batch, env, ctx)
		expect(handler).toHaveBeenCalledWith(7, messages[0], env, ctx)
	})

	it('applies a fixed or attempt-based retryDelay', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {})
		const fail = async () => {
			throw new Error('x')
		}
		const fixed = fakeBatch([1])
		await defineQueue(fail, { retryDelay: 30 })(fixed.batch, {}, ctx)
		expect(fixed.messages[0]?.retry).toHaveBeenCalledWith({ delaySeconds: 30 })

		const backoff = fakeBatch([1], 3)
		await defineQueue(fail, { retryDelay: (n) => n * 10 })(backoff.batch, {}, ctx)
		expect(backoff.messages[0]?.retry).toHaveBeenCalledWith({ delaySeconds: 30 })
	})
})
