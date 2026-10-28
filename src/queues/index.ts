import { CloudflareError } from '../errors/index.js'

/** Cloudflare accepts at most 100 messages per `sendBatch` call. */
const MAX_BATCH = 100

/** A typed producer bound to one `Queue` binding. */
export interface QueueProducer<T> {
	/** Enqueue one message. Throws `QUEUE_SEND_FAILED` if the binding rejects it. */
	send(body: T, options?: QueueSendOptions): Promise<void>
	/**
	 * Enqueue many messages, split into calls of at most 100 (Cloudflare's limit).
	 * Chunks are sent in order and sending stops at the first failure, so
	 * earlier chunks stay enqueued. Throws `QUEUE_SEND_FAILED`.
	 */
	sendBatch(bodies: Iterable<T>, options?: QueueSendBatchOptions): Promise<void>
}

/**
 * Wrap a `Queue` producer binding so `send` and `sendBatch` take plain bodies
 * and failures surface as a {@link CloudflareError}.
 *
 * @example
 * const jobs = createProducer<EmailJob>(env.EMAILS)
 * await jobs.send({ to: 'ada@example.com' }, { delaySeconds: 30 })
 * await jobs.sendBatch(recipients.map((to) => ({ to })))
 */
export function createProducer<T = unknown>(queue: Queue<T>): QueueProducer<T> {
	return {
		async send(body, options) {
			try {
				await queue.send(body, options)
			} catch (cause) {
				throw sendFailed(cause)
			}
		},
		async sendBatch(bodies, options) {
			const all = [...bodies]
			for (let i = 0; i < all.length; i += MAX_BATCH) {
				const chunk = all.slice(i, i + MAX_BATCH).map((body) => ({ body }))
				try {
					await queue.sendBatch(chunk, options)
				} catch (cause) {
					throw sendFailed(cause)
				}
			}
		},
	}
}

function sendFailed(cause: unknown): CloudflareError {
	return new CloudflareError('Failed to send to queue', {
		status: 502,
		code: 'QUEUE_SEND_FAILED',
		cause,
	})
}

export interface QueueOptions {
	/**
	 * Seconds to wait before a failed message is redelivered. A function gets
	 * the message's `attempts` (1 on the first delivery) so you can back off.
	 * Defaults to Cloudflare's immediate redelivery.
	 */
	retryDelay?: number | ((attempts: number) => number)
}

/** Handles one message body. Throw to retry that message. */
export type QueueHandler<T, Env> = (
	body: T,
	message: Message<T>,
	env: Env,
	ctx: ExecutionContext
) => void | Promise<void>

/**
 * Build a `queue` handler that runs `handler` once per message and settles each
 * one on its own: `ack()` when it returns, `retry()` when it throws. One bad
 * message no longer retries the whole batch. Messages run concurrently, and
 * once a message exhausts `max_retries` Cloudflare moves it to the dead-letter
 * queue, if you configured one.
 *
 * @example
 * export default {
 *   queue: defineQueue<EmailJob, Env>(async (job, _msg, env) => sendEmail(env, job), {
 *     retryDelay: (attempts) => 2 ** attempts * 10,
 *   }),
 * }
 */
export function defineQueue<T = unknown, Env = unknown>(
	handler: QueueHandler<T, Env>,
	options: QueueOptions = {}
): (batch: MessageBatch<T>, env: Env, ctx: ExecutionContext) => Promise<void> {
	return async (batch, env, ctx) => {
		await Promise.all(
			batch.messages.map(async (message) => {
				try {
					await handler(message.body, message, env, ctx)
					message.ack()
				} catch (error) {
					console.error(`queue "${batch.queue}" message ${message.id} failed`, error)
					const { retryDelay } = options
					const delaySeconds =
						typeof retryDelay === 'function' ? retryDelay(message.attempts) : retryDelay
					message.retry(delaySeconds === undefined ? undefined : { delaySeconds })
				}
			})
		)
	}
}
