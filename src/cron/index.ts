import { CloudflareError } from '../errors/index.js'

/** A single scheduled job. `controller.cron`/`.scheduledTime` tell you which fired and when. */
export type ScheduledJob<Env> = (
	controller: ScheduledController,
	env: Env,
	ctx: ExecutionContext
) => void | Promise<void>

/**
 * Build a `scheduled` handler that routes each cron expression to a named job,
 * so one Worker with several triggers stays a flat map instead of an
 * `if (cron === …)` ladder. Keys must match the `crons` in `wrangler.jsonc`.
 *
 * Throws a {@link CloudflareError} if a trigger fires with no matching job —
 * a misconfiguration worth surfacing in logs, not swallowing.
 *
 * @example
 * export default {
 *   scheduled: defineScheduled({
 *     '0 * * * *': async (_c, env) => rollupHourly(env),
 *     '0 0 * * *': async (_c, env) => rollupDaily(env),
 *   }),
 * }
 */
export function defineScheduled<Env = unknown>(
	jobs: Record<string, ScheduledJob<Env>>
): (controller: ScheduledController, env: Env, ctx: ExecutionContext) => Promise<void> {
	return async (controller, env, ctx) => {
		const job = jobs[controller.cron]
		if (!job) {
			throw new CloudflareError(`No scheduled job for cron "${controller.cron}"`, {
				code: 'CRON_NO_MATCH',
			})
		}
		await job(controller, env, ctx)
	}
}
