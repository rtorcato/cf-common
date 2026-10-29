import type { Pipeline } from 'cloudflare:pipelines'
import { describe, expect, it, vi } from 'vitest'
import { isCloudflareError } from '../errors/index'
import { createPipelineProducer } from './index'

interface Event extends Record<string, unknown> {
	n: number
}

function fakePipeline(send: (records: Event[]) => Promise<void> = async () => {}) {
	return { send: vi.fn(send) } as unknown as Pipeline<Event> & { send: ReturnType<typeof vi.fn> }
}

const events = (count: number): Event[] => Array.from({ length: count }, (_, n) => ({ n }))

describe('pipelines module', () => {
	it('send wraps the record in an array', async () => {
		const pipeline = fakePipeline()

		await createPipelineProducer(pipeline).send({ n: 1 })

		expect(pipeline.send).toHaveBeenCalledWith([{ n: 1 }])
	})

	it('sendBatch splits into chunks of 100 by default, in order', async () => {
		const pipeline = fakePipeline()

		await createPipelineProducer(pipeline).sendBatch(events(250))

		expect(pipeline.send.mock.calls.map(([chunk]) => chunk.length)).toEqual([100, 100, 50])
		expect(pipeline.send.mock.calls[2]?.[0][0]).toEqual({ n: 200 })
	})

	it('sendBatch honours chunkSize and makes no call for an empty input', async () => {
		const pipeline = fakePipeline()
		const producer = createPipelineProducer(pipeline)

		await producer.sendBatch(events(5), { chunkSize: 2 })
		expect(pipeline.send).toHaveBeenCalledTimes(3)

		pipeline.send.mockClear()
		await producer.sendBatch([])
		expect(pipeline.send).not.toHaveBeenCalled()
	})

	it('maps a rejected send to a non-exposed 502 and keeps the cause', async () => {
		const upstream = new Error('pipeline unavailable')
		const pipeline = fakePipeline(async () => {
			throw upstream
		})

		const err = await createPipelineProducer(pipeline)
			.send({ n: 1 })
			.catch((e: unknown) => e)

		expect(isCloudflareError(err)).toBe(true)
		expect(isCloudflareError(err) && err.status).toBe(502)
		expect(isCloudflareError(err) && err.expose).toBe(false)
		expect(isCloudflareError(err) && err.code).toBe('PIPELINE_SEND_FAILED')
		expect((err as Error).cause).toBe(upstream)
	})

	it('sendBatch stops at the first failed chunk', async () => {
		const pipeline = fakePipeline()
		pipeline.send.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('boom'))

		const err = await createPipelineProducer(pipeline)
			.sendBatch(events(250))
			.catch((e: unknown) => e)

		expect(isCloudflareError(err) && err.code).toBe('PIPELINE_SEND_FAILED')
		expect(pipeline.send).toHaveBeenCalledTimes(2)
	})

	it('sendBatch rejects a bad chunkSize before sending', async () => {
		const pipeline = fakePipeline()

		for (const chunkSize of [0, -1, 1.5, Number.NaN]) {
			const err = await createPipelineProducer(pipeline)
				.sendBatch(events(3), { chunkSize })
				.catch((e: unknown) => e)
			expect(isCloudflareError(err) && err.code).toBe('PIPELINE_INVALID_CHUNK_SIZE')
		}
		expect(pipeline.send).not.toHaveBeenCalled()
	})

	it('types records by shape', () => {
		const producer = createPipelineProducer<Event>(fakePipeline())

		// @ts-expect-error missing field
		void producer.send({})
		// @ts-expect-error wrong field type
		void producer.send({ n: 'x' })
	})
})
