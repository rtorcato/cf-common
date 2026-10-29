import { env } from 'cloudflare:test'
import { describe, expect, it, vi } from 'vitest'
import { createWorkflow } from './index'

// Runs on the workers pool against a real Workflow (TestWorkflow in
// ../do/fixture.workers.ts, bound as TEST_WF).
describe('createWorkflow (workers pool)', () => {
	const wf = createWorkflow<{ n: number }, { doubled: number }>(env.TEST_WF)

	it('runs an instance and reports its typed output', async () => {
		const { id } = await wf.create({ n: 21 }, { id: 'double-21' })

		await vi.waitFor(async () => expect((await wf.status(id)).status).toBe('complete'), {
			timeout: 5000,
		})
		expect((await wf.status(id)).output?.doubled).toBe(42)
	})

	it('maps a missing instance to WORKFLOW_FAILED', async () => {
		await expect(wf.status('nope')).rejects.toMatchObject({ code: 'WORKFLOW_FAILED', status: 502 })
	})

	it('maps a duplicate id to WORKFLOW_FAILED', async () => {
		await wf.create({ n: 1 }, { id: 'dup' })
		await expect(wf.create({ n: 1 }, { id: 'dup' })).rejects.toMatchObject({
			code: 'WORKFLOW_FAILED',
		})
	})
})
