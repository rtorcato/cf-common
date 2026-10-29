import {
	WorkerEntrypoint,
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
} from 'cloudflare:workers'
import { acceptWebSocket, broadcast, getAttachment, parseMessage, sendMessage } from '../ws/index'
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

// The ws suite's chat room, bound as TEST_WS: hibernatable sockets tagged by
// room, each echoing a validated message to the others with the sender's name.
export class TestChat extends BaseDurableObject {
	override async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url)
		return acceptWebSocket(request, this.ctx, {
			tags: [url.searchParams.get('room') ?? 'lobby'],
			attachment: { name: url.searchParams.get('name') ?? 'anon' },
		})
	}

	override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		const from = getAttachment<{ name: string }>(ws)?.name
		try {
			const { text, room } = parseMessage(message, {
				parse: (input) => input as { text: string; room?: string },
			})
			const sent = broadcast(this.ctx, { from, text }, { tag: room, except: ws })
			sendMessage(ws, { ack: sent })
		} catch (e) {
			sendMessage(ws, { error: (e as { code?: string }).code })
		}
	}
}

export default {
	fetch: () => new Response(null, { status: 404 }),
} satisfies ExportedHandler
