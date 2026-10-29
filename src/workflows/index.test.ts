import { describe, expect, it, vi } from 'vitest'
import { createWorkflow } from './index'

const instance = (status: unknown = { status: 'complete', output: { userId: 'u_1' } }) =>
	({ id: 'ada', status: vi.fn(async () => status) }) as unknown as WorkflowInstance

function fakeBinding(overrides: Partial<Record<'create' | 'get', unknown>> = {}) {
	const inst = instance()
	return {
		inst,
		binding: {
			create: vi.fn(async () => inst),
			get: vi.fn(async () => inst),
			...overrides,
		} as unknown as Workflow<{ email: string }>,
	}
}

describe('workflows module', () => {
	it('create passes params and options through and returns the instance', async () => {
		const { binding, inst } = fakeBinding()
		const wf = createWorkflow<{ email: string }>(binding)

		expect(await wf.create({ email: 'a@b.c' }, { id: 'ada' })).toBe(inst)
		expect(binding.create).toHaveBeenCalledWith({ id: 'ada', params: { email: 'a@b.c' } })
	})

	it('get returns the instance handle', async () => {
		const { binding, inst } = fakeBinding()
		expect(await createWorkflow(binding).get('ada')).toBe(inst)
		expect(binding.get).toHaveBeenCalledWith('ada')
	})

	it('status returns the instance status', async () => {
		const { binding } = fakeBinding()
		const wf = createWorkflow<{ email: string }, { userId: string }>(binding)
		expect((await wf.status('ada')).output?.userId).toBe('u_1')
	})

	it.each(['create', 'get', 'status'] as const)(
		'%s maps a failure to a non-exposed 502 and keeps the cause',
		async (method) => {
			const upstream = new Error('instance.not_found')
			const { binding } = fakeBinding({
				create: vi.fn().mockRejectedValue(upstream),
				get: vi.fn().mockRejectedValue(upstream),
			})
			const wf = createWorkflow<{ email: string }>(binding)

			const call = method === 'create' ? wf.create({ email: 'a@b.c' }) : wf[method]('ada')
			await expect(call).rejects.toMatchObject({
				status: 502,
				expose: false,
				code: 'WORKFLOW_FAILED',
				message: `Workflow ${method} failed`,
				cause: upstream,
			})
		}
	)

	it('status maps a failing instance.status() too', async () => {
		const bad = { status: vi.fn().mockRejectedValue(new Error('boom')) }
		const { binding } = fakeBinding({ get: vi.fn(async () => bad) })
		await expect(createWorkflow(binding).status('ada')).rejects.toMatchObject({
			code: 'WORKFLOW_FAILED',
		})
	})
})
