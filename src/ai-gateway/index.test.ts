import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAiGateway, gatewayHeaders, gatewayUrl } from './index'

const TOKEN = 'gw-token-123'
const BASE = 'https://gateway.ai.cloudflare.com/v1/acct/prod'

function stubFetch(respond: () => Response | Promise<Response>) {
	const calls: { url: string; init: RequestInit }[] = []
	vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
		calls.push({ url, init: init ?? {} })
		return respond()
	})
	return calls
}

const first = (calls: { url: string; init: RequestInit }[]) => {
	expect(calls).toHaveLength(1)
	return calls[0] as { url: string; init: RequestInit }
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
	try {
		await promise
	} catch (err) {
		return err
	}
	expect.unreachable()
}

afterEach(() => vi.unstubAllGlobals())

describe('ai-gateway module', () => {
	it('gatewayUrl builds the base and provider URLs, encoding each segment', () => {
		expect(gatewayUrl({ accountId: 'acct', gatewayId: 'prod' })).toBe(BASE)
		expect(gatewayUrl({ accountId: 'acct', gatewayId: 'prod' }, 'openai')).toBe(`${BASE}/openai`)
		expect(gatewayUrl({ accountId: 'acct', gatewayId: 'a/b' })).toBe(
			'https://gateway.ai.cloudflare.com/v1/acct/a%2Fb'
		)
	})

	it.each([
		['', 'prod', undefined],
		['acct', '..', undefined],
		['acct', 'prod', '.'],
		['acct', 'prod', '%2E%2e'],
	])('gatewayUrl rejects account %j, gateway %j, provider %j', (accountId, gatewayId, provider) => {
		expect(() => gatewayUrl({ accountId, gatewayId }, provider)).toThrow(
			expect.objectContaining({ status: 500, expose: false, code: 'AI_GATEWAY_INVALID' })
		)
	})

	it('gatewayHeaders maps every option to its cf-aig header and skips unset ones', () => {
		expect(gatewayHeaders()).toEqual({})
		expect(
			gatewayHeaders(
				{
					cacheKey: 'k',
					cacheTtl: 300,
					skipCache: false,
					collectLog: true,
					eventId: 'e1',
					requestTimeoutMs: 5000,
					retries: { maxAttempts: 3, retryDelayMs: 100, backoff: 'exponential' },
					metadata: { user: 'u_1', n: 10n },
				},
				TOKEN
			)
		).toEqual({
			'cf-aig-authorization': `Bearer ${TOKEN}`,
			'cf-aig-cache-key': 'k',
			'cf-aig-cache-ttl': '300',
			'cf-aig-skip-cache': 'false',
			'cf-aig-collect-log': 'true',
			'cf-aig-event-id': 'e1',
			'cf-aig-request-timeout': '5000',
			'cf-aig-max-attempts': '3',
			'cf-aig-retry-delay': '100',
			'cf-aig-backoff': 'exponential',
			'cf-aig-metadata': '{"user":"u_1","n":"10"}',
		})
	})

	it('fetch sends to the provider path with init and gateway headers merged', async () => {
		const calls = stubFetch(() => new Response('ok'))
		const gw = createAiGateway({ accountId: 'acct', gatewayId: 'prod', token: TOKEN })
		const res = await gw.fetch(
			'anthropic',
			'/v1/messages',
			{ method: 'POST', headers: { 'x-api-key': 'sk', 'cf-aig-cache-ttl': '1' } },
			{ cacheTtl: 60 }
		)

		expect(await res.text()).toBe('ok')
		const call = first(calls)
		expect(call.url).toBe(`${BASE}/anthropic/v1/messages`)
		expect(call.init.method).toBe('POST')
		const headers = call.init.headers as Headers
		expect(headers.get('x-api-key')).toBe('sk')
		expect(headers.get('cf-aig-cache-ttl')).toBe('60')
		expect(headers.get('cf-aig-authorization')).toBe(`Bearer ${TOKEN}`)
	})

	it('json posts JSON and returns the parsed body', async () => {
		const calls = stubFetch(() => Response.json({ id: 'c1' }))
		const gw = createAiGateway({ accountId: 'acct', gatewayId: 'prod' })
		const out = await gw.json<{ id: string }>('openai', '/chat/completions', { model: 'm' })

		expect(out).toEqual({ id: 'c1' })
		const call = first(calls)
		expect(call.init.method).toBe('POST')
		expect(call.init.body).toBe('{"model":"m"}')
		expect((call.init.headers as Headers).get('content-type')).toBe('application/json')
		expect((call.init.headers as Headers).has('cf-aig-authorization')).toBe(false)
	})

	it('rejects a path that resolves outside the provider before sending', async () => {
		const calls = stubFetch(() => new Response('ok'))
		const gw = createAiGateway({ accountId: 'acct', gatewayId: 'prod' })
		for (const path of [
			'/../../other/prod/openai',
			'/%2e%2E/%2e%2e/other/prod/openai',
			'/..\\..\\other/prod/openai',
			'/.\t./.\t./other/prod/openai',
			'evil',
		]) {
			expect(await caught(gw.fetch('openai', path))).toMatchObject({ code: 'AI_GATEWAY_INVALID' })
		}
		expect(calls).toHaveLength(0)
	})

	it('maps a non-2xx response to AI_GATEWAY_FAILED with status and body on cause', async () => {
		stubFetch(() => new Response('rate limited', { status: 429 }))
		const gw = createAiGateway({ accountId: 'acct', gatewayId: 'prod', token: TOKEN })
		const err = (await caught(gw.json('openai', '/chat/completions', {}))) as Error & {
			cause: unknown
		}

		expect(err).toMatchObject({ status: 502, expose: false, code: 'AI_GATEWAY_FAILED' })
		expect(err.cause).toEqual({ status: 429, body: 'rate limited' })
		expect(err.message).not.toContain(TOKEN)
	})

	it('maps a network error and a non-JSON body to AI_GATEWAY_FAILED', async () => {
		const gw = createAiGateway({ accountId: 'acct', gatewayId: 'prod' })
		vi.stubGlobal('fetch', async () => {
			throw new TypeError('connect failed')
		})
		expect(await caught(gw.fetch('openai', '/x'))).toMatchObject({ code: 'AI_GATEWAY_FAILED' })

		stubFetch(() => new Response('<html>'))
		expect(await caught(gw.json('openai', '/x', {}))).toMatchObject({ code: 'AI_GATEWAY_FAILED' })
	})
})
