import { CloudflareError } from '../errors/index.js'

/**
 * Run a Workers AI model through its binding, with input and output types
 * picked by model name. Every model family (text generation, embeddings,
 * image, speech, …) is typed by the `AiModels` map in `@cloudflare/workers-types`,
 * so a wrong input shape fails at compile time.
 *
 * A failed call (quota, model error, upstream outage) throws a non-exposed 502
 * with code `AI_RUN_FAILED`. The model is upstream of the client, so its
 * details stay in logs and out of the response.
 *
 * @example
 * const ai = getBinding<Ai>(env, 'AI')
 * const { response } = await runAi(ai, '@cf/meta/llama-3.2-3b-instruct', {
 *   prompt: 'Name one Cloudflare product.',
 * })
 */
export async function runAi<Name extends keyof AiModels>(
	ai: Ai,
	model: Name,
	inputs: AiModels[Name]['inputs'],
	options?: AiOptions
): Promise<AiModels[Name]['postProcessedOutputs']> {
	try {
		return await ai.run(model, inputs, options)
	} catch (cause) {
		throw new CloudflareError(`Workers AI model ${String(model)} failed`, {
			status: 502,
			expose: false,
			code: 'AI_RUN_FAILED',
			cause,
		})
	}
}
