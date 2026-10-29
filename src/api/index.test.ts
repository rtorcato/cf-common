import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCloudflareError } from '../errors/index'
import { createCloudflareApi } from './index'

const TOKEN = 'secret-token-123'
const BASE = 'https://api.cloudflare.com/client/v4'

// Stub global fetch; capture each request's url and init for assertions.
function stubFetch(respond: () => Response | Promise<Response>) {
	const calls: { url: string; init: RequestInit }[] = []
	vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
		calls.push({ url, init: init ?? {} })
		return respond()
	})
	return calls
}

const ok = (result: unknown, result_info?: unknown) =>
	Response.json({ success: true, errors: [], messages: [], result, result_info })

async function caught(promise: Promise<unknown>): Promise<unknown> {
	try {
		await promise
	} catch (err) {
		return err
	}
	expect.unreachable()
}

afterEach(() => vi.unstubAllGlobals())

describe('api module', () => {
	const cf = createCloudflareApi({ token: TOKEN })

	it('zones.list builds the query, skips undefined and returns one page', async () => {
		const info = { page: 2, per_page: 20, count: 1, total_count: 21, total_pages: 2 }
		const calls = stubFetch(() => ok([{ id: 'z1' }], info))
		const page = await cf.zones.list({ name: 'a.com', page: 2, x: undefined })

		expect(page).toEqual({ result: [{ id: 'z1' }], resultInfo: info })
		expect(calls[0]!.url).toBe(`${BASE}/zones?name=a.com&page=2`)
		expect(calls[0]!.init.method).toBe('GET')
		const headers = calls[0]!.init.headers as Record<string, string>
		expect(headers['Authorization']).toBe(`Bearer ${TOKEN}`)
		expect(headers['Content-Type']).toBeUndefined()
		expect(calls[0]!.init.body).toBeUndefined()
	})

	it('dns.create and dns.update send JSON with POST and PATCH', async () => {
		const calls = stubFetch(() => ok({ id: 'r1' }))
		await cf.dns.create('z', { type: 'A', name: 'a.com', content: '1.2.3.4' })
		await cf.dns.update('z', 'r1', { proxied: true })

		expect(calls[0]!.url).toBe(`${BASE}/zones/z/dns_records`)
		expect(calls[0]!.init.method).toBe('POST')
		expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
			type: 'A',
			name: 'a.com',
			content: '1.2.3.4',
		})
		expect((calls[0]!.init.headers as Record<string, string>)['Content-Type']).toBe(
			'application/json'
		)
		expect(calls[1]!.url).toBe(`${BASE}/zones/z/dns_records/r1`)
		expect(calls[1]!.init.method).toBe('PATCH')
		expect(JSON.parse(calls[1]!.init.body as string)).toEqual({ proxied: true })
	})

	it('dns.delete sends DELETE and returns { id }', async () => {
		const calls = stubFetch(() => ok({ id: 'r1' }))
		expect(await cf.dns.delete('z', 'r1')).toEqual({ id: 'r1' })
		expect(calls[0]!.init.method).toBe('DELETE')
	})

	it('cache.purge posts the body to purge_cache', async () => {
		const calls = stubFetch(() => ok({ id: 'p1' }))
		await cf.cache.purge('z', { purge_everything: true })
		expect(calls[0]!.url).toBe(`${BASE}/zones/z/purge_cache`)
		expect(calls[0]!.init.method).toBe('POST')
		expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ purge_everything: true })
	})

	it('encodes ids so they cannot change the endpoint', async () => {
		const calls = stubFetch(() => ok({ id: 'x' }))
		await cf.zones.get('a/b?c')
		await cf.dns.delete('a/b?c', '../r')
		expect(calls[0]!.url).toBe(`${BASE}/zones/a%2Fb%3Fc`)
		expect(calls[1]!.url).toBe(`${BASE}/zones/a%2Fb%3Fc/dns_records/..%2Fr`)
	})

	it('maps success: false to a non-exposed 502 with the upstream status on cause', async () => {
		stubFetch(() =>
			Response.json(
				{ success: false, errors: [{ code: 1004, message: 'DNS Validation Error' }], result: null },
				{ status: 400 }
			)
		)
		const err = await caught(cf.dns.create('z', { type: 'A', name: 'a', content: 'bad' }))
		expect(isCloudflareError(err)).toBe(true)
		expect(err).toMatchObject({ status: 502, expose: false, code: 'CF_API_ERROR' })
		expect((err as Error).message).toContain('DNS Validation Error')
		expect((err as Error).cause).toEqual({
			status: 400,
			errors: [{ code: 1004, message: 'DNS Validation Error' }],
		})
	})

	it('maps a non-JSON error page to the same error with no errors', async () => {
		stubFetch(() => new Response('<html>bad gateway</html>', { status: 503 }))
		const err = await caught(cf.zones.list())
		expect(err).toMatchObject({
			status: 502,
			code: 'CF_API_ERROR',
			cause: { status: 503, errors: [] },
		})
	})

	it('treats a 200 with success: false as a failure', async () => {
		stubFetch(() => Response.json({ success: false, errors: [], result: null }))
		await expect(cf.zones.get('z')).rejects.toMatchObject({ code: 'CF_API_ERROR' })
	})

	it('maps a rejecting fetch to CF_API_ERROR with the original error as cause', async () => {
		const boom = new TypeError('network down')
		stubFetch(() => Promise.reject(boom))
		const err = await caught(cf.zones.list())
		expect(err).toMatchObject({ status: 502, code: 'CF_API_ERROR' })
		expect((err as Error).cause).toBe(boom)
	})

	it('never puts the token in the message or cause', async () => {
		stubFetch(() =>
			Response.json(
				{ success: false, errors: [{ code: 10000, message: 'Authentication error' }] },
				{
					status: 403,
				}
			)
		)
		const err = (await caught(cf.request('GET', '/user/tokens/verify'))) as Error
		expect(err.message).not.toContain(TOKEN)
		expect(JSON.stringify(err.cause)).not.toContain(TOKEN)
	})

	it('request passes the path verbatim and returns result', async () => {
		const calls = stubFetch(() => ok({ status: 'active' }))
		const result = await cf.request<{ status: string }>('GET', '/user/tokens/verify', {
			query: { a: 1 },
		})
		expect(result).toEqual({ status: 'active' })
		expect(calls[0]!.url).toBe(`${BASE}/user/tokens/verify?a=1`)
	})
})
