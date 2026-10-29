import { describe, expect, it, vi } from 'vitest'
import { isCloudflareError } from '../errors/index'
import { getSecret } from './index'

describe('secrets module', () => {
	it('returns the secret value from the named binding', async () => {
		const get = vi.fn(async () => 's3cret')
		expect(await getSecret({ API_KEY: { get } }, 'API_KEY')).toBe('s3cret')
		expect(get).toHaveBeenCalledTimes(1)
	})

	it('throws a non-exposed 500 when the binding is missing', async () => {
		const err = await getSecret({}, 'API_KEY').catch((e) => e)
		expect(isCloudflareError(err)).toBe(true)
		expect(err).toMatchObject({ status: 500, expose: false })
	})

	it('maps a failed read to SECRET_GET_FAILED with the original as cause', async () => {
		const cause = new Error('secret not found')
		const err = await getSecret(
			{
				API_KEY: {
					get: async () => {
						throw cause
					},
				},
			},
			'API_KEY'
		).catch((e) => e)

		expect(err).toMatchObject({ status: 500, expose: false, code: 'SECRET_GET_FAILED', cause })
		expect(err.message).toBe('Failed to read secret: API_KEY')
	})
})
