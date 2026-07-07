import { describe, expect, it } from 'vitest'
import { CloudflareError } from '../errors/index'
import { corsHeaders, defineFetch, error, errorResponse, preflight, withCors } from './index'

describe('http module', () => {
	it('error() builds a JSON envelope with the status', async () => {
		const res = error(404, 'Not found')
		expect(res.status).toBe(404)
		expect(await res.json()).toEqual({ error: 'Not found' })
	})

	it('errorResponse keeps status/code for CloudflareError', async () => {
		const res = errorResponse(new CloudflareError('Nope', { status: 404, code: 'GONE' }))
		expect(res.status).toBe(404)
		expect(await res.json()).toEqual({ error: 'Nope', code: 'GONE' })
	})

	it('errorResponse hides the message for a 5xx', async () => {
		const res = errorResponse(new Error('secret db string'))
		expect(res.status).toBe(500)
		expect(await res.json()).toEqual({ error: 'Internal error', code: undefined })
	})

	it('corsHeaders uses defaults and honors overrides', () => {
		expect(corsHeaders()['Access-Control-Allow-Origin']).toBe('*')
		const custom = corsHeaders({ origin: 'https://a.dev', maxAge: 600 })
		expect(custom['Access-Control-Allow-Origin']).toBe('https://a.dev')
		expect(custom['Access-Control-Max-Age']).toBe('600')
	})

	it('withCors adds headers without dropping the body', async () => {
		const res = withCors(Response.json({ ok: true }), { origin: 'https://a.dev' })
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://a.dev')
		expect(await res.json()).toEqual({ ok: true })
	})

	it('preflight is a 204 with CORS headers', () => {
		const res = preflight()
		expect(res.status).toBe(204)
		expect(res.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS')
	})

	it('defineFetch passes success through and maps thrown errors', async () => {
		const handler = defineFetch<unknown>((req) => {
			if (new URL(req.url).pathname === '/boom') {
				throw new CloudflareError('kaboom', { status: 418, code: 'TEAPOT' })
			}
			return Response.json({ ok: true })
		})
		const ctx = {} as ExecutionContext
		const ok = await handler.fetch!(new Request('https://x/'), {}, ctx)
		expect(await ok.json()).toEqual({ ok: true })
		const boom = await handler.fetch!(new Request('https://x/boom'), {}, ctx)
		expect(boom.status).toBe(418)
		expect(await boom.json()).toEqual({ error: 'kaboom', code: 'TEAPOT' })
	})
})
