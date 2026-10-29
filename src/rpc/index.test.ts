import { describe, expect, it, vi } from 'vitest'
import { isCloudflareError } from '../errors/index'
import { callService, getService } from './index'

describe('rpc module', () => {
	it('getService returns the bound service', () => {
		const auth = { fetch: vi.fn() }
		expect(getService({ AUTH: auth }, 'AUTH')).toBe(auth)
	})

	it('getService throws a non-exposed 500 when the binding is missing', () => {
		try {
			getService({}, 'AUTH')
			expect.unreachable()
		} catch (err) {
			expect(isCloudflareError(err) && err.status).toBe(500)
			expect(isCloudflareError(err) && err.expose).toBe(false)
			expect((err as Error).message).toContain('AUTH')
		}
	})

	it('callService returns the result, sync or async', async () => {
		expect(await callService('AUTH', async () => 42)).toBe(42)
		expect(await callService('AUTH', () => 'sync')).toBe('sync')
	})

	it('callService maps a failure to a non-exposed 502 and keeps the cause', async () => {
		const upstream = new Error('callee blew up')

		try {
			await callService('AUTH', () => Promise.reject(upstream))
			expect.unreachable()
		} catch (err) {
			expect(isCloudflareError(err)).toBe(true)
			expect(isCloudflareError(err) && err.status).toBe(502)
			expect(isCloudflareError(err) && err.expose).toBe(false)
			expect(isCloudflareError(err) && err.code).toBe('RPC_CALL_FAILED')
			expect((err as Error).message).toBe('RPC call to AUTH failed')
			expect((err as Error).cause).toBe(upstream)
		}
	})

	it('callService maps a synchronous throw the same way', async () => {
		await expect(
			callService('AUTH', () => {
				throw new Error('nope')
			})
		).rejects.toMatchObject({ code: 'RPC_CALL_FAILED', status: 502 })
	})
})
