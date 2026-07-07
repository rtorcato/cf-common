import { describe, expect, it, vi } from 'vitest'
import { defineScheduled } from './index'

function controller(cron: string): ScheduledController {
	return { cron, scheduledTime: 0, noRetry: () => {} } as unknown as ScheduledController
}

describe('cron module', () => {
	it('routes each cron expression to its job', async () => {
		const hourly = vi.fn()
		const daily = vi.fn()
		const scheduled = defineScheduled<unknown>({ '0 * * * *': hourly, '0 0 * * *': daily })

		const ctx = {} as ExecutionContext
		await scheduled(controller('0 0 * * *'), {}, ctx)
		expect(daily).toHaveBeenCalledOnce()
		expect(hourly).not.toHaveBeenCalled()
	})

	it('throws CRON_NO_MATCH when no job matches', async () => {
		const scheduled = defineScheduled<unknown>({ '0 * * * *': vi.fn() })
		await expect(
			scheduled(controller('5 5 * * *'), {}, {} as ExecutionContext)
		).rejects.toMatchObject({
			code: 'CRON_NO_MATCH',
		})
	})
})
