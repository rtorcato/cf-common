import { describe, expect, it } from 'vitest'
import { isCloudflareError } from '../errors/index'
import { bearerToken, cf, clientIp, parseJson } from './index'

/** A schema with the `parse` contract parseJson needs, without pulling in Zod. */
const emailSchema = {
	parse(input: unknown): { email: string } {
		if (typeof input !== 'object' || input === null || typeof (input as any).email !== 'string') {
			throw new Error('email is required')
		}
		return input as { email: string }
	},
}

/** Build a Request with a JSON body without going through a real network fetch. */
function jsonRequest(body: string, headers: Record<string, string> = {}): Request {
	return new Request('https://example.com', { method: 'POST', body, headers })
}

describe('request module', () => {
	it('parseJson returns the validated body', async () => {
		const out = await parseJson(jsonRequest('{"email":"a@b.dev"}'), emailSchema)
		expect(out).toEqual({ email: 'a@b.dev' })
	})

	it('parseJson throws an exposed 400 on malformed JSON', async () => {
		try {
			await parseJson(jsonRequest('{not json'), emailSchema)
			expect.unreachable()
		} catch (err) {
			expect(isCloudflareError(err) && err.status).toBe(400)
			expect(isCloudflareError(err) && err.code).toBe('INVALID_BODY')
			expect(isCloudflareError(err) && err.expose).toBe(true)
		}
	})

	it('parseJson throws a 400 carrying the validation message', async () => {
		try {
			await parseJson(jsonRequest('{"email":123}'), emailSchema)
			expect.unreachable()
		} catch (err) {
			expect(isCloudflareError(err) && err.status).toBe(400)
			expect(isCloudflareError(err) && err.message).toBe('email is required')
		}
	})

	it('bearerToken parses a well-formed header, case-insensitively', () => {
		expect(bearerToken(jsonRequest('{}', { Authorization: 'Bearer abc123' }))).toBe('abc123')
		expect(bearerToken(jsonRequest('{}', { Authorization: 'bearer abc123' }))).toBe('abc123')
	})

	it('bearerToken returns null when absent or malformed', () => {
		expect(bearerToken(jsonRequest('{}'))).toBeNull()
		expect(bearerToken(jsonRequest('{}', { Authorization: 'Basic abc123' }))).toBeNull()
		expect(bearerToken(jsonRequest('{}', { Authorization: 'Bearer' }))).toBeNull()
	})

	it('clientIp reads CF-Connecting-IP, else null', () => {
		expect(clientIp(jsonRequest('{}', { 'CF-Connecting-IP': '1.2.3.4' }))).toBe('1.2.3.4')
		expect(clientIp(jsonRequest('{}'))).toBeNull()
	})

	it('cf returns undefined for a synthetic Request', () => {
		expect(cf(jsonRequest('{}'))).toBeUndefined()
	})
})
