import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCloudflareError } from '../errors/index'
import { assertTurnstile, verifyTurnstile } from './index'

// Stub global fetch; capture the last request init for assertions.
function stubFetch(response: Response) {
	const calls: RequestInit[] = []
	vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
		calls.push(init ?? {})
		return response
	})
	return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('turnstile module', () => {
	it('verifyTurnstile posts secret + token and returns the result', async () => {
		const calls = stubFetch(Response.json({ success: true, hostname: 'a.dev' }))
		const result = await verifyTurnstile('tok', 'sec', { remoteip: '1.2.3.4' })
		expect(result.success).toBe(true)

		const body = calls[0]!.body as FormData
		expect(body.get('secret')).toBe('sec')
		expect(body.get('response')).toBe('tok')
		expect(body.get('remoteip')).toBe('1.2.3.4')
	})

	it('verifyTurnstile throws on a transport error', async () => {
		stubFetch(new Response('', { status: 500 }))
		await expect(verifyTurnstile('tok', 'sec')).rejects.toMatchObject({
			code: 'TURNSTILE_HTTP_ERROR',
		})
	})

	it('assertTurnstile throws a 403 carrying the first error-code', async () => {
		stubFetch(Response.json({ success: false, 'error-codes': ['invalid-input-response'] }))
		try {
			await assertTurnstile('tok', 'sec')
			expect.unreachable()
		} catch (err) {
			expect(isCloudflareError(err) && err.status).toBe(403)
			expect(isCloudflareError(err) && err.code).toBe('invalid-input-response')
		}
	})

	it('assertTurnstile returns the result when the challenge passes', async () => {
		stubFetch(Response.json({ success: true }))
		expect((await assertTurnstile('tok', 'sec')).success).toBe(true)
	})
})
