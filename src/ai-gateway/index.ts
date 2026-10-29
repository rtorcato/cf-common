import { CloudflareError } from '../errors/index.js'

/** AI Gateway's provider endpoint host. */
const BASE_URL = 'https://gateway.ai.cloudflare.com/v1'

/** Which gateway to call. `token` is only needed for an authenticated gateway. */
export interface AiGatewayConfig {
	accountId: string
	gatewayId: string
	/** An API token with AI Gateway Run, sent as `cf-aig-authorization`. */
	token?: string
}

/**
 * Per-request gateway settings. The names match the `gateway` option of the
 * Workers AI binding's `run()` (minus `id`), so the same object works for both.
 */
export type AiGatewayOptions = Omit<GatewayOptions, 'id'>

/** A typed client over one AI Gateway's provider endpoints. */
export interface AiGatewayClient {
	/** The gateway's base URL, or a provider's endpoint when `provider` is given. */
	url(provider?: string): string
	/**
	 * Send a request to `provider` through the gateway and return the response,
	 * so a streamed body is still readable. `path` is the provider's own path
	 * (for `openai`, `/chat/completions`). A network error or a non-2xx status
	 * throws a non-exposed 502 `AI_GATEWAY_FAILED`.
	 */
	fetch(
		provider: string,
		path: string,
		init?: RequestInit,
		options?: AiGatewayOptions
	): Promise<Response>
	/**
	 * POST `body` as JSON and return the parsed response, typed as `T`
	 * (asserted, not validated). Also throws `AI_GATEWAY_FAILED` on a non-JSON
	 * response.
	 */
	json<T>(provider: string, path: string, body: unknown, options?: AiGatewayOptions): Promise<T>
}

const invalid = (what: string) =>
	new CloudflareError(`Invalid AI Gateway ${what}`, {
		status: 500,
		expose: false,
		code: 'AI_GATEWAY_INVALID',
	})

// A `.`/`..` segment (also percent-encoded) would let fetch resolve the URL to
// another gateway or account on the same host, with the same credentials.
const DOT_SEGMENT = /^(\.|%2e){1,2}$/i

function segment(value: string, what: string): string {
	if (!value || DOT_SEGMENT.test(value)) throw invalid(what)
	return encodeURIComponent(value)
}

/**
 * Build a gateway URL: `https://gateway.ai.cloudflare.com/v1/<account>/<gateway>`,
 * plus `/<provider>` when given. An empty id or a `.`/`..` one throws a
 * non-exposed 500 `AI_GATEWAY_INVALID`, since the ids come from config.
 *
 * @example
 * gatewayUrl({ accountId, gatewayId: 'prod' }, 'openai')
 * // https://gateway.ai.cloudflare.com/v1/<accountId>/prod/openai
 */
export function gatewayUrl(
	config: Pick<AiGatewayConfig, 'accountId' | 'gatewayId'>,
	provider?: string
): string {
	const base = `${BASE_URL}/${segment(config.accountId, 'account id')}/${segment(config.gatewayId, 'gateway id')}`
	return provider === undefined ? base : `${base}/${segment(provider, 'provider')}`
}

/**
 * Turn {@link AiGatewayOptions} (and an optional gateway token) into the
 * `cf-aig-*` request headers. Unset options add no header.
 *
 * @example
 * fetch(url, { headers: { ...gatewayHeaders({ cacheTtl: 300, metadata: { user: 'u_1' } }) } })
 */
export function gatewayHeaders(
	options: AiGatewayOptions = {},
	token?: string
): Record<string, string> {
	const headers: Record<string, string> = {}
	const set = (name: string, value: unknown) => {
		if (value !== undefined) headers[`cf-aig-${name}`] = String(value)
	}
	if (token) headers['cf-aig-authorization'] = `Bearer ${token}`
	set('cache-key', options.cacheKey)
	set('cache-ttl', options.cacheTtl)
	set('skip-cache', options.skipCache)
	set('collect-log', options.collectLog)
	set('event-id', options.eventId)
	set('request-timeout', options.requestTimeoutMs)
	set('max-attempts', options.retries?.maxAttempts)
	set('retry-delay', options.retries?.retryDelayMs)
	set('backoff', options.retries?.backoff)
	if (options.metadata) {
		// ponytail: bigint metadata goes out as a string; JSON has no bigint.
		set(
			'metadata',
			JSON.stringify(options.metadata, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
		)
	}
	return headers
}

/**
 * A client for one AI Gateway: provider calls go through the gateway's
 * endpoint with the `cf-aig-*` headers set from typed options. Use it for
 * external providers (OpenAI, Anthropic, …) and for Workers AI over REST; from a
 * Worker with an AI binding, `runAi(ai, model, inputs, { gateway: { id, … } })`
 * routes through the gateway without it.
 *
 * Every failure throws a non-exposed 502 {@link CloudflareError} with code
 * `AI_GATEWAY_FAILED`; the upstream status and body are on `cause`. Neither the
 * gateway token nor the provider key appears in the error.
 *
 * @example
 * const gateway = createAiGateway({ accountId, gatewayId: 'prod' })
 * const completion = await gateway.json<ChatCompletion>(
 *   'openai',
 *   '/chat/completions',
 *   { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] },
 *   { cacheTtl: 3600 }
 * )
 */
export function createAiGateway(config: AiGatewayConfig): AiGatewayClient {
	const url = (provider?: string) => gatewayUrl(config, provider)

	const fail = (provider: string, detail: string, cause: unknown) =>
		new CloudflareError(`AI Gateway ${provider} request failed (${detail})`, {
			status: 502,
			expose: false,
			code: 'AI_GATEWAY_FAILED',
			cause,
		})

	const send: AiGatewayClient['fetch'] = async (provider, path, init = {}, options) => {
		// Check the resolved URL, not the raw string: the URL parser also treats `\`
		// as a separator and strips tabs, so `/..\..\other` escapes the provider.
		const base = new URL(url(provider))
		const target = new URL(`${base.href}${path}`)
		if (
			target.origin !== base.origin ||
			(target.pathname !== base.pathname && !target.pathname.startsWith(`${base.pathname}/`))
		) {
			throw invalid('path')
		}
		const headers = new Headers(init.headers)
		for (const [name, value] of Object.entries(gatewayHeaders(options, config.token))) {
			headers.set(name, value)
		}
		let res: Response
		try {
			res = await fetch(target.href, { ...init, headers })
		} catch (err) {
			throw fail(provider, 'network', err)
		}
		if (!res.ok) {
			const body = await res.text().catch(() => '')
			throw fail(provider, String(res.status), { status: res.status, body })
		}
		return res
	}

	return {
		url,
		fetch: send,
		async json(provider, path, body, options) {
			const res = await send(
				provider,
				path,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				},
				options
			)
			try {
				return await res.json()
			} catch (err) {
				throw fail(provider, 'invalid JSON', err)
			}
		},
	}
}
