import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import type { TestService } from '../do/fixture.workers'
import { isCloudflareError } from '../errors/index'
import { callService, getService } from './index'

// Runs on the workers pool against a real service binding (TEST_SVC → the
// TestService entrypoint in ../do/fixture.workers.ts), so the calls cross a real
// RPC boundary.
describe('rpc module (workers pool)', () => {
	const svc = getService<typeof TestService>(env, 'TEST_SVC')

	it('calls a typed entrypoint method over the binding', async () => {
		expect(await callService('TEST_SVC', () => svc.add(2, 3))).toBe(5)
	})

	it('maps a callee that throws to RPC_CALL_FAILED', async () => {
		const err = await callService('TEST_SVC', () => svc.fail()).catch((e) => e)
		expect(isCloudflareError(err) && err.code).toBe('RPC_CALL_FAILED')
		expect(isCloudflareError(err) && err.status).toBe(502)
		expect((err as Error).cause).toBeInstanceOf(Error)
	})
})
