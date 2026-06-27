import { describe, expect, it } from 'vitest'
import { CloudflareError } from '../errors'
import { getBinding, getEnv, requireEnv } from './index'

const env = { KV: { get: () => null }, API_KEY: 'secret', EMPTY: '' }

describe('getBinding', () => {
	it('returns a present binding', () => {
		expect(getBinding(env, 'KV')).toBe(env.KV)
	})

	it('throws a CloudflareError for a missing binding', () => {
		expect(() => getBinding(env, 'NOPE')).toThrowError(CloudflareError)
	})
})

describe('requireEnv', () => {
	it('returns a string var', () => {
		expect(requireEnv(env, 'API_KEY')).toBe('secret')
	})

	it('rejects empty or missing vars', () => {
		expect(() => requireEnv(env, 'EMPTY')).toThrow()
		expect(() => requireEnv(env, 'NOPE')).toThrow()
	})
})

describe('getEnv', () => {
	it('returns the value or falls back when unset/empty', () => {
		expect(getEnv(env, 'API_KEY')).toBe('secret')
		expect(getEnv(env, 'EMPTY', 'def')).toBe('def')
		expect(getEnv(env, 'NOPE')).toBeUndefined()
	})
})
