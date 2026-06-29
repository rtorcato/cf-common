import { describe, expect, it } from 'vitest'
import { CloudflareError, isCloudflareError, toCloudflareError } from './index'

describe('CloudflareError', () => {
	it('defaults to a non-exposed 500', () => {
		const err = new CloudflareError('boom')
		expect(err.status).toBe(500)
		expect(err.expose).toBe(false)
		expect(err.name).toBe('CloudflareError')
		expect(isCloudflareError(err)).toBe(true)
	})

	it('exposes 4xx by default but honours an explicit override', () => {
		expect(new CloudflareError('bad', { status: 400 }).expose).toBe(true)
		expect(new CloudflareError('hush', { status: 400, expose: false }).expose).toBe(false)
	})

	it('keeps the cause', () => {
		const cause = new Error('root')
		expect(new CloudflareError('wrap', { cause }).cause).toBe(cause)
	})
})

describe('toCloudflareError', () => {
	it('wraps unknown values as a 500', () => {
		const wrapped = toCloudflareError('oops')
		expect(wrapped.status).toBe(500)
		expect(wrapped.message).toBe('oops')
	})

	it('passes an existing CloudflareError through unchanged', () => {
		const original = new CloudflareError('keep', { status: 404 })
		expect(toCloudflareError(original)).toBe(original)
	})
})
