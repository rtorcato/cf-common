import { CloudflareError } from '../errors/index.js'

/** Cloudflare's Turnstile server-side verification endpoint. */
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** The `siteverify` response. See Cloudflare's Turnstile docs for `error-codes`. */
export interface TurnstileResult {
	success: boolean
	/** ISO timestamp of the challenge, when `success`. */
	challenge_ts?: string
	hostname?: string
	action?: string
	cdata?: string
	'error-codes'?: string[]
}

/**
 * Verify a Turnstile token server-side. Returns the raw `siteverify` result —
 * inspect `.success`. Throws a {@link CloudflareError} only if the HTTP call
 * itself fails (not on a failed challenge, which is a normal `success: false`).
 *
 * @example
 * const result = await verifyTurnstile(token, env.TURNSTILE_SECRET, { remoteip })
 * if (!result.success) return error(403, 'Failed challenge')
 */
export async function verifyTurnstile(
	token: string,
	secret: string,
	options: { remoteip?: string } = {}
): Promise<TurnstileResult> {
	const body = new FormData()
	body.append('secret', secret)
	body.append('response', token)
	if (options.remoteip) body.append('remoteip', options.remoteip)

	const res = await fetch(SITEVERIFY_URL, { method: 'POST', body })
	if (!res.ok) {
		throw new CloudflareError(`Turnstile siteverify returned ${res.status}`, {
			status: 502,
			code: 'TURNSTILE_HTTP_ERROR',
		})
	}
	return res.json<TurnstileResult>()
}

/**
 * Like {@link verifyTurnstile} but throws a `403` {@link CloudflareError} on a
 * failed challenge, so callers can rely on the token being valid past this point.
 * The `code` carries Turnstile's first `error-code` for branching.
 */
export async function assertTurnstile(
	token: string,
	secret: string,
	options: { remoteip?: string } = {}
): Promise<TurnstileResult> {
	const result = await verifyTurnstile(token, secret, options)
	if (!result.success) {
		throw new CloudflareError('Turnstile challenge failed', {
			status: 403,
			code: result['error-codes']?.[0] ?? 'TURNSTILE_FAILED',
		})
	}
	return result
}
