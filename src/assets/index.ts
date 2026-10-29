/**
 * Thin helpers over the Static Assets binding (`env.ASSETS`): fetch an asset at
 * another path, and serve a request with an SPA or 404-page fallback decided
 * in code. Not a router.
 */

/** Options for {@link serveAssets}. */
export interface ServeAssetsOptions {
	/**
	 * Serve this path (usually `'/'`, where `index.html` lives) for a page
	 * navigation that matched no asset, with status 200. Only `GET`/`HEAD`
	 * requests whose `Accept` header includes `text/html` fall back, so a
	 * missing `/app.js` still 404s.
	 */
	spa?: string
	/** Serve this path's body with status 404 when nothing else matched. */
	notFound?: string
}

/**
 * Fetch the asset at `path` (resolved against the request URL) with the
 * request's method and headers. Use it to map a route onto a different asset,
 * e.g. `/blog/<slug>` onto `/blog/post`. A `POST` becomes a `GET`, since the
 * binding only serves reads.
 *
 * @example
 * return fetchAsset(env.ASSETS, request, '/offline')
 */
export function fetchAsset(assets: Fetcher, request: Request, path: string): Promise<Response> {
	const url = new URL(path, request.url)
	return assets.fetch(
		new Request(url, {
			method: request.method === 'HEAD' ? 'HEAD' : 'GET',
			headers: request.headers,
		})
	)
}

/**
 * Serve `request` from the Static Assets binding. If no asset matched (404),
 * fall back to `spa` for a page navigation, then to `notFound` as a 404 page;
 * otherwise return the binding's response as is.
 *
 * Paths are the URLs the assets are served at, so with the default
 * `html_handling` that is `'/'` for `index.html` and `'/404'` for `404.html`.
 * If the whole site wants one rule, `not_found_handling` in wrangler config
 * does this without code; this helper is for choosing per route.
 *
 * @example
 * if (url.pathname.startsWith('/app')) return serveAssets(env.ASSETS, request, { spa: '/app/' })
 * return serveAssets(env.ASSETS, request, { notFound: '/404' })
 */
export async function serveAssets(
	assets: Fetcher,
	request: Request,
	options: ServeAssetsOptions = {}
): Promise<Response> {
	const res = await assets.fetch(request)
	if (res.status !== 404) return res

	const navigation =
		(request.method === 'GET' || request.method === 'HEAD') &&
		(request.headers.get('Accept') ?? '').includes('text/html')
	if (options.spa !== undefined && navigation) {
		return fetchAsset(assets, request, options.spa)
	}
	if (options.notFound !== undefined) {
		const page = await fetchAsset(assets, request, options.notFound)
		if (page.ok) return new Response(page.body, { status: 404, headers: page.headers })
	}
	return res
}
