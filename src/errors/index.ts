import { getErrorMessage } from '@rtorcato/js-common/errors'

/**
 * An error that carries an HTTP `status`, for Workers that turn thrown errors
 * into `Response`s.
 *
 * `expose` marks whether `message` is safe to send to the client: it defaults
 * to `true` for 4xx (the caller's fault, tell them why) and `false` for 5xx
 * (our fault — don't leak internals).
 *
 * @example
 * throw new CloudflareError('Session not found', { status: 404 })
 */
export class CloudflareError extends Error {
	override readonly name = 'CloudflareError'
	readonly status: number
	readonly expose: boolean
	/** Optional machine-readable code (e.g. `KV_PARSE_FAILED`) for branching on a specific failure. */
	readonly code?: string

	constructor(
		message: string,
		options: { status?: number; expose?: boolean; code?: string; cause?: unknown } = {}
	) {
		super(message, { cause: options.cause })
		this.status = options.status ?? 500
		this.expose = options.expose ?? this.status < 500
		this.code = options.code
	}
}

/** Type guard for {@link CloudflareError}. */
export function isCloudflareError(error: unknown): error is CloudflareError {
	return error instanceof CloudflareError
}

/**
 * Coerce any thrown value into a {@link CloudflareError}, passing an existing
 * one through unchanged. Reuses js-common's `getErrorMessage` for the message
 * and defaults to a non-exposed 500.
 */
export function toCloudflareError(error: unknown, status = 500): CloudflareError {
	if (isCloudflareError(error)) return error
	return new CloudflareError(getErrorMessage(error), { status, cause: error })
}
