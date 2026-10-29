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

export default {
	fetch: () => new Response(null, { status: 404 }),
} satisfies ExportedHandler
