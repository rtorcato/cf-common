import { describe, expect, it, vi } from 'vitest'
import { isCloudflareError } from '../errors/index'
import { runAi } from './index'

// A stand-in for the Workers AI binding: only `run` is exercised.
function fakeAi(run: (...args: unknown[]) => unknown) {
	return { run: vi.fn(async (...args: unknown[]) => run(...args)) } as unknown as Ai
}

describe('ai module', () => {
	it('runAi forwards model, inputs and options, and returns the output', async () => {
		const ai = fakeAi(() => ({ response: 'Workers' }))
		const options = { gateway: { id: 'gw' } }

		const out = await runAi(ai, '@cf/meta/llama-3.2-3b-instruct', { prompt: 'hi' }, options)

		expect(out).toEqual({ response: 'Workers' })
		expect(ai.run).toHaveBeenCalledWith('@cf/meta/llama-3.2-3b-instruct', { prompt: 'hi' }, options)
	})

	it('runAi maps a failed call to a non-exposed 502 and keeps the cause', async () => {
		const upstream = new Error('model overloaded')
		const ai = fakeAi(() => Promise.reject(upstream))

		try {
			await runAi(ai, '@cf/meta/llama-3.2-3b-instruct', { prompt: 'hi' })
			expect.unreachable()
		} catch (err) {
			expect(isCloudflareError(err)).toBe(true)
			expect(isCloudflareError(err) && err.status).toBe(502)
			expect(isCloudflareError(err) && err.expose).toBe(false)
			expect(isCloudflareError(err) && err.code).toBe('AI_RUN_FAILED')
			expect((err as Error).cause).toBe(upstream)
		}
	})
})
