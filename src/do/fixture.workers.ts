import {
	WorkerEntrypoint,
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
} from 'cloudflare:workers'
import { BaseDurableObject } from './index'

// The workers pool's `main` (vitest.workers.config.ts): Miniflare can only bind
// Durable Object classes exported from it, so the do tests' counter lives here.
export class TestCounter extends BaseDurableObject<unknown, { count: number }> {
	async peek(): Promise<number | undefined> {
		return this.storage.get('count')
	}

	async increment(by = 1): Promise<number> {
		const count = (await this.storage.get('count', 0)) + by
		await this.storage.put('count', count)
		return count
	}

	async reset(): Promise<boolean> {
		return this.storage.delete('count')
	}
}

// The rpc suite's callee, bound as TEST_SVC (a service binding to this worker's
// own TestService entrypoint).
export class TestService extends WorkerEntrypoint {
	async add(a: number, b: number): Promise<number> {
		return a + b
	}

	async fail(): Promise<never> {
		throw new Error('callee failed')
	}
}

// The workflows suite's Workflow, bound as TEST_WF.
export class TestWorkflow extends WorkflowEntrypoint<unknown, { n: number }> {
	override async run(event: Readonly<WorkflowEvent<{ n: number }>>, step: WorkflowStep) {
		return step.do('double', async () => ({ doubled: event.payload.n * 2 }))
	}
}

export default {
	fetch: () => new Response(null, { status: 404 }),
} satisfies ExportedHandler
