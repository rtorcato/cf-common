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

describe('isCloudflareError across bundle boundaries', () => {
	// tsup bundles each subpath separately, so a CloudflareError thrown by one
	// module is a different class object than another module's. Simulate that
	// with a look-alike from a distinct class: `instanceof` fails, but the guard
	// must still recognise it (else defineFetch mis-maps its status to 500).
	class ForeignCloudflareError extends Error {
		override name = 'CloudflareError'
		status = 400
		expose = true
		code = 'INVALID_BODY'
	}

	it('recognises a structurally-identical error from another bundle', () => {
		const foreign = new ForeignCloudflareError('bad body')
		expect(foreign instanceof CloudflareError).toBe(false)
		expect(isCloudflareError(foreign)).toBe(true)
		expect(toCloudflareError(foreign).status).toBe(400)
	})

	it('does not match unrelated errors', () => {
		expect(isCloudflareError(new Error('plain'))).toBe(false)
		expect(isCloudflareError(new TypeError('nope'))).toBe(false)
		expect(isCloudflareError({ name: 'CloudflareError', status: 400 })).toBe(false)
	})
})
