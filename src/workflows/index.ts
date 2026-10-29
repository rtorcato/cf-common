import { CloudflareError } from '../errors/index.js'

/** What `status()` reports. `output` is whatever the Workflow's `run` returned. */
export type WorkflowStatus<Result = unknown> = Omit<InstanceStatus, 'output'> & {
	output?: Result
}

/** A typed client over one Workflow binding. */
export interface WorkflowClient<Params, Result> {
	/**
	 * Start a new instance. Pass `id` to choose it (it must be unique within the
	 * Workflow); omit it and Cloudflare generates one. Throws `WORKFLOW_FAILED`.
	 */
	create(
		params: Params,
		options?: Omit<WorkflowInstanceCreateOptions<Params>, 'params'>
	): Promise<WorkflowInstance>
	/** Get a handle to an existing instance. Throws `WORKFLOW_FAILED` if it doesn't exist. */
	get(id: string): Promise<WorkflowInstance>
	/** Read an instance's status, with `output` typed as `Result`. Throws `WORKFLOW_FAILED`. */
	status(id: string): Promise<WorkflowStatus<Result>>
}

/**
 * Wrap a `Workflow` binding so `create` takes typed params, `status` returns a
 * typed `output`, and failures surface as a {@link CloudflareError}.
 *
 * The Workflow class itself is `WorkflowEntrypoint` from `cloudflare:workers`,
 * already typed by `@cloudflare/workers-types` (`event.payload`, `step.do`,
 * `step.sleep`). This is the caller's side of it.
 *
 * @example
 * const signups = createWorkflow<{ email: string }, { userId: string }>(env.SIGNUP)
 * const instance = await signups.create({ email: 'ada@example.com' }, { id: 'ada' })
 * const { status, output } = await signups.status(instance.id)
 */
export function createWorkflow<Params = unknown, Result = unknown>(
	workflow: Workflow<Params>
): WorkflowClient<Params, Result> {
	return {
		async create(params, options) {
			try {
				return await workflow.create({ ...options, params })
			} catch (cause) {
				throw failed('create', cause)
			}
		},
		async get(id) {
			try {
				return await workflow.get(id)
			} catch (cause) {
				throw failed('get', cause)
			}
		},
		async status(id) {
			try {
				const instance = await workflow.get(id)
				return (await instance.status()) as WorkflowStatus<Result>
			} catch (cause) {
				throw failed('status', cause)
			}
		},
	}
}

// The Workflow is upstream of the client, so details stay in logs (like `ai`).
function failed(method: string, cause: unknown): CloudflareError {
	return new CloudflareError(`Workflow ${method} failed`, {
		status: 502,
		expose: false,
		code: 'WORKFLOW_FAILED',
		cause,
	})
}
