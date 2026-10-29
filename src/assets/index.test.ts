import { describe, expect, it, vi } from 'vitest'
import { fetchAsset, serveAssets } from './index'

// A fake ASSETS binding serving a fixed set of paths; anything else is a 404.
function fakeAssets(files: Record<string, string>) {
	const requests: Request[] = []
	const fetch = vi.fn(async (input: Request) => {
		requests.push(input)
		const body = files[new URL(input.url).pathname]
		return body === undefined
			? new Response('Not found', { status: 404 })
			: new Response(body, { headers: { 'Content-Type': 'text/html' } })
	})
	return { assets: { fetch } as unknown as Fetcher, requests }
}

const nav = (path: string, init: RequestInit = {}) =>
	new Request(`https://site.test${path}`, { headers: { Accept: 'text/html,*/*' }, ...init })

describe('assets module', () => {
	it('fetchAsset fetches another path with the request headers, as GET', async () => {
		const { assets, requests } = fakeAssets({ '/offline': 'offline' })
		const res = await fetchAsset(
			assets,
			new Request('https://site.test/x?q=1', { method: 'POST', headers: { 'X-A': '1' } }),
			'/offline'
		)

		expect(await res.text()).toBe('offline')
		expect(requests[0]?.url).toBe('https://site.test/offline')
		expect(requests[0]?.method).toBe('GET')
		expect(requests[0]?.headers.get('X-A')).toBe('1')
	})

	it('fetchAsset keeps HEAD', async () => {
		const { assets, requests } = fakeAssets({ '/': 'home' })
		await fetchAsset(assets, new Request('https://site.test/a', { method: 'HEAD' }), '/')
		expect(requests[0]?.method).toBe('HEAD')
	})

	it('serveAssets returns a matched asset unchanged', async () => {
		const { assets, requests } = fakeAssets({ '/about': 'about' })
		const res = await serveAssets(assets, nav('/about'), { spa: '/', notFound: '/404' })
		expect(await res.text()).toBe('about')
		expect(requests).toHaveLength(1)
	})

	it('serveAssets falls back to the SPA shell for a page navigation', async () => {
		const { assets } = fakeAssets({ '/': 'shell' })
		const res = await serveAssets(assets, nav('/app/settings'), { spa: '/' })
		expect(res.status).toBe(200)
		expect(await res.text()).toBe('shell')
	})

	it.each([
		['a non-HTML request', nav('/app.js', { headers: { Accept: '*/*' } })],
		['a POST', nav('/form', { method: 'POST' })],
	])('serveAssets does not use the SPA shell for %s', async (_, request) => {
		const { assets } = fakeAssets({ '/': 'shell', '/404': 'missing' })
		const res = await serveAssets(assets, request, { spa: '/', notFound: '/404' })
		expect(res.status).toBe(404)
		expect(await res.text()).toBe('missing')
	})

	it('serveAssets serves the 404 page with status 404 and its headers', async () => {
		const { assets } = fakeAssets({ '/404': 'missing' })
		const res = await serveAssets(assets, nav('/nope'), { notFound: '/404' })
		expect(res.status).toBe(404)
		expect(res.headers.get('Content-Type')).toBe('text/html')
		expect(await res.text()).toBe('missing')
	})

	it("serveAssets returns the binding's 404 when there is no fallback or the page is missing", async () => {
		const { assets } = fakeAssets({})
		expect(await (await serveAssets(assets, nav('/nope'))).text()).toBe('Not found')
		const res = await serveAssets(assets, nav('/nope'), { notFound: '/404' })
		expect(res.status).toBe(404)
		expect(await res.text()).toBe('Not found')
	})
})
