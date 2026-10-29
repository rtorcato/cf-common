import type { Pipeline, PipelineRecord } from 'cloudflare:pipelines'
import { CloudflareError } from '../errors/index.js'

/** Records sent per `send` call by `sendBatch` unless `chunkSize` says otherwise. */
const DEFAULT_CHUNK_SIZE = 100

/** A typed producer bound to one Pipeline binding. */
export interface PipelineProducer<T extends PipelineRecord> {
	/** Send one record. Throws `PIPELINE_SEND_FAILED` if the binding rejects it. */
	send(record: T): Promise<void>
	/**
	 * Send many records, split into `send` calls of `chunkSize` (default 100).
	 * Chunks are sent in order and sending stops at the first failure, so
	 * earlier chunks stay delivered. Throws `PIPELINE_SEND_FAILED`.
	 */
	sendBatch(records: Iterable<T>, options?: { chunkSize?: number }): Promise<void>
}

/**
 * Wrap a Pipeline binding (R2-backed streaming ingestion) so `send` and
 * `sendBatch` take plain, typed records and failures surface as a
 * {@link CloudflareError}. The record type `T` is asserted by the caller and
 * not validated at runtime.
 *
 * @example
 * const events = createPipelineProducer<{ userId: string; action: string }>(env.EVENTS)
 * await events.send({ userId: 'u_1', action: 'login' })
 * await events.sendBatch(rows.map((r) => ({ userId: r.id, action: 'import' })))
 */
export function createPipelineProducer<T extends PipelineRecord = PipelineRecord>(
	pipeline: Pipeline<T>
): PipelineProducer<T> {
	async function deliver(records: T[]) {
		try {
			await pipeline.send(records)
		} catch (cause) {
			throw new CloudflareError('Failed to send to pipeline', {
				status: 502,
				expose: false,
				code: 'PIPELINE_SEND_FAILED',
				cause,
			})
		}
	}

	return {
		send: (record) => deliver([record]),
		async sendBatch(records, { chunkSize = DEFAULT_CHUNK_SIZE } = {}) {
			if (!Number.isInteger(chunkSize) || chunkSize < 1) {
				throw new CloudflareError('chunkSize must be a positive integer', {
					status: 500,
					expose: false,
					code: 'PIPELINE_INVALID_CHUNK_SIZE',
				})
			}
			const all = [...records]
			for (let i = 0; i < all.length; i += chunkSize) {
				await deliver(all.slice(i, i + chunkSize))
			}
		},
	}
}
