import { describe, expect, it, vi } from 'vitest'
import { isCloudflareError } from '../errors/index'
import { withHyperdrive } from './index'

// A stand-in for the Hyperdrive binding: only `connectionString` is read.
const hd = { connectionString: 'postgres://u:p@h:5432/db' } as unknown as Hyperdrive

// A fake `ExecutionContext` that records what it is asked to wait for.
function fakeCtx() {
	return { waitUntil: vi.fn() } as unknown as ExecutionContext & {
		waitUntil: ReturnType<typeof vi.fn>
	}
}

describe('hyperdrive module', () => {
	it('connects with the connection string, passes the client to work, and returns its result', async () => {
		const client = { query: vi.fn() }
		const connect = vi.fn(async () => client)
		const close = vi.fn()

		const out = await withHyperdrive(hd, { connect, close }, async (c) => {
			expect(c).toBe(client)
			return 'rows'
		})

		expect(out).toBe('rows')
		expect(connect).toHaveBeenCalledWith('postgres://u:p@h:5432/db')
		expect(close).toHaveBeenCalledOnce()
		expect(close).toHaveBeenCalledWith(client)
	})

	it('closes the client once and rethrows the same error when work throws', async () => {
		const close = vi.fn()
		const upstream = new Error('syntax error')

		await expect(
			withHyperdrive(hd, { connect: () => ({}), close }, () => Promise.reject(upstream))
		).rejects.toBe(upstream)

		expect(close).toHaveBeenCalledOnce()
	})

	it('maps a failed connect to a non-exposed 502 and skips close', async () => {
		const close = vi.fn()
		const upstream = new Error('ECONNREFUSED')

		try {
			await withHyperdrive(
				hd,
				{ connect: () => Promise.reject(upstream), close },
				async () => 'unused'
			)
			expect.unreachable()
		} catch (err) {
			expect(isCloudflareError(err)).toBe(true)
			expect(isCloudflareError(err) && err.status).toBe(502)
			expect(isCloudflareError(err) && err.expose).toBe(false)
			expect(isCloudflareError(err) && err.code).toBe('HYPERDRIVE_CONNECT_FAILED')
			expect((err as Error).cause).toBe(upstream)
		}
		expect(close).not.toHaveBeenCalled()
	})

	it('hands close to ctx.waitUntil when ctx is given', async () => {
		const ctx = fakeCtx()
		const close = vi.fn()

		const out = await withHyperdrive(hd, { connect: () => ({}), close, ctx }, async () => 'rows')

		expect(out).toBe('rows')
		expect(ctx.waitUntil).toHaveBeenCalledOnce()
		await ctx.waitUntil.mock.calls[0]?.[0]
		expect(close).toHaveBeenCalledOnce()
	})

	it.each([
		['awaited', undefined],
		['via ctx.waitUntil', fakeCtx()],
	])("drops a failing close without replacing work's result (%s)", async (_label, ctx) => {
		const close = vi.fn(() => Promise.reject(new Error('socket reset')))

		const out = await withHyperdrive(hd, { connect: () => ({}), close, ctx }, async () => 'rows')

		expect(out).toBe('rows')
		if (ctx) await ctx.waitUntil.mock.calls[0]?.[0]
		expect(close).toHaveBeenCalledOnce()
	})
})
