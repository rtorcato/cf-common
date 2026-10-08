/** Structural type of Cloudflare's native Rate Limiting binding (`[[ratelimits]]`). */
export interface RateLimitBinding {
	limit(options: { key: string }): Promise<{ success: boolean }>
}

/** A typed rate limiter bound to one Rate Limiting binding. */
export interface RateLimiter {
	/** Count one request against `key`. `success: false` means over the limit. */
	limit(options: { key: string }): Promise<{ success: boolean }>
	/** Limit by client IP (`CF-Connecting-IP`), falling back to `'unknown'`. */
	limitByIp(request: Request): Promise<{ success: boolean }>
	/** Limit by an arbitrary identifier (user id, API key, ...), optionally scoped by `prefix`. */
	limitBy(id: string, prefix?: string): Promise<{ success: boolean }>
}

/**
 * Wrap a Rate Limiting binding.
 *
 * @example
 * const limiter = rateLimit(env.MY_RATE_LIMITER)
 * const { success } = await limiter.limitByIp(request)
 * if (!success) return new Response('Too many requests', { status: 429 })
 */
export function rateLimit(binding: RateLimitBinding): RateLimiter {
	const limit = async (options: { key: string }) => ({
		success: (await binding.limit({ key: options.key })).success,
	})
	return {
		limit,
		// ponytail: all clients without the header share one 'unknown' bucket.
		limitByIp: (request) => limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' }),
		limitBy: (id, prefix) => limit({ key: prefix ? `${prefix}:${id}` : id }),
	}
}
