import puppeteer, {
	type Browser,
	type BrowserWorker,
	type GoToOptions,
	type PDFOptions,
	type ScreenshotOptions,
	type Viewport,
	type WorkersLaunchOptions,
} from '@cloudflare/puppeteer'
import { CloudflareError, isCloudflareError } from '../errors/index.js'

/** The page to render: a URL to load, or an HTML string to set as the content. */
export type RenderTarget = { url: string } | { html: string }

/** Options shared by {@link screenshot} and {@link pdf}. */
export interface RenderOptions {
	/** Page size before loading. Puppeteer's default is 800×600. */
	viewport?: Viewport
	/** When navigation counts as done, e.g. `'networkidle0'`, and its `timeout` in ms. */
	waitUntil?: GoToOptions['waitUntil']
	timeout?: number
	/** Passed to `puppeteer.launch` (`keep_alive`, …). */
	launch?: WorkersLaunchOptions
}

/**
 * Launch a browser on the Browser Rendering binding, run `work` with it, and
 * always close it, also when `work` throws. A failed launch (no binding, the
 * concurrency or rate limit reached) throws a non-exposed 502
 * `BROWSER_LAUNCH_FAILED` with the original as `cause`. Errors from `work` pass
 * through unchanged.
 *
 * @example
 * const title = await withBrowser(env.BROWSER, async (browser) => {
 *   const page = await browser.newPage()
 *   await page.goto('https://example.com')
 *   return page.title()
 * })
 */
export async function withBrowser<R>(
	binding: BrowserWorker,
	work: (browser: Browser) => Promise<R>,
	options?: WorkersLaunchOptions
): Promise<R> {
	let browser: Browser
	try {
		browser = await puppeteer.launch(binding, options)
	} catch (cause) {
		throw new CloudflareError('Browser Rendering launch failed', {
			status: 502,
			expose: false,
			code: 'BROWSER_LAUNCH_FAILED',
			cause,
		})
	}
	try {
		return await work(browser)
	} finally {
		try {
			await browser.close()
		} catch {
			// ponytail: a failed close is dropped on purpose, so it can't replace work's result or error.
		}
	}
}

// Only http(s) pages: `file:`, `data:`, `javascript:` or `chrome:` URLs have no
// place in a render, and the URL often comes from a request.
function checkUrl(url: string): void {
	let protocol: string
	try {
		protocol = new URL(url).protocol
	} catch {
		protocol = ''
	}
	if (protocol !== 'http:' && protocol !== 'https:') {
		throw new CloudflareError('Render URL must be http or https', {
			status: 400,
			code: 'BROWSER_INVALID_URL',
		})
	}
}

async function render<T>(
	binding: BrowserWorker,
	target: RenderTarget,
	options: RenderOptions,
	capture: (page: Awaited<ReturnType<Browser['newPage']>>) => Promise<T>
): Promise<T> {
	if ('url' in target) checkUrl(target.url)
	return withBrowser(
		binding,
		async (browser) => {
			try {
				const page = await browser.newPage()
				if (options.viewport) await page.setViewport(options.viewport)
				const wait = { waitUntil: options.waitUntil, timeout: options.timeout }
				if ('url' in target) await page.goto(target.url, wait)
				else await page.setContent(target.html, wait)
				return await capture(page)
			} catch (cause) {
				if (isCloudflareError(cause)) throw cause
				throw new CloudflareError('Browser Rendering failed', {
					status: 502,
					expose: false,
					code: 'BROWSER_RENDER_FAILED',
					cause,
				})
			}
		},
		options.launch
	)
}

/**
 * Render a page and return a screenshot (PNG unless `screenshot.type` says
 * otherwise). A URL that isn't http(s) throws an exposed 400
 * `BROWSER_INVALID_URL`; a failed navigation or capture throws a non-exposed
 * 502 `BROWSER_RENDER_FAILED`.
 *
 * @example
 * const png = await screenshot(env.BROWSER, { url: 'https://example.com' }, {
 *   viewport: { width: 1200, height: 630 },
 * })
 * return new Response(png, { headers: { 'Content-Type': 'image/png' } })
 */
export function screenshot(
	binding: BrowserWorker,
	target: RenderTarget,
	options: RenderOptions & { screenshot?: Omit<ScreenshotOptions, 'encoding' | 'path'> } = {}
): Promise<Uint8Array> {
	return render(binding, target, options, (page) => page.screenshot(options.screenshot))
}

/**
 * Render a page and return it as a PDF. Same errors as {@link screenshot}.
 *
 * @example
 * const file = await pdf(env.BROWSER, { html: invoiceHtml }, { pdf: { format: 'A4', printBackground: true } })
 */
export function pdf(
	binding: BrowserWorker,
	target: RenderTarget,
	options: RenderOptions & { pdf?: Omit<PDFOptions, 'path'> } = {}
): Promise<Uint8Array> {
	return render(binding, target, options, (page) => page.pdf(options.pdf))
}
