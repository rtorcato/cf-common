import puppeteer from '@cloudflare/puppeteer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pdf, screenshot, withBrowser } from './index'

vi.mock('@cloudflare/puppeteer', () => ({ default: { launch: vi.fn() } }))

const binding = {} as never

function fakeBrowser(pageOverrides: Record<string, unknown> = {}) {
	const page = {
		setViewport: vi.fn(async () => {}),
		goto: vi.fn(async () => null),
		setContent: vi.fn(async () => {}),
		screenshot: vi.fn(async () => new Uint8Array([1])),
		pdf: vi.fn(async () => new Uint8Array([2])),
		...pageOverrides,
	}
	const browser = { newPage: vi.fn(async () => page), close: vi.fn(async () => {}) }
	vi.mocked(puppeteer.launch).mockResolvedValue(browser as never)
	return { browser, page }
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
	try {
		await promise
	} catch (err) {
		return err
	}
	expect.unreachable()
}

beforeEach(() => {
	vi.mocked(puppeteer.launch).mockReset()
})

describe('browser module', () => {
	it('withBrowser launches with the options, returns work’s result and closes', async () => {
		const { browser } = fakeBrowser()
		expect(await withBrowser(binding, async () => 'ok', { keep_alive: 60_000 })).toBe('ok')
		expect(puppeteer.launch).toHaveBeenCalledWith(binding, { keep_alive: 60_000 })
		expect(browser.close).toHaveBeenCalledOnce()
	})

	it('withBrowser closes and rethrows when work throws, even if close fails', async () => {
		const { browser } = fakeBrowser()
		browser.close.mockRejectedValue(new Error('close failed'))
		const boom = new Error('boom')
		expect(await caught(withBrowser(binding, async () => Promise.reject(boom)))).toBe(boom)
		expect(browser.close).toHaveBeenCalledOnce()
	})

	it('withBrowser maps a failed launch to BROWSER_LAUNCH_FAILED', async () => {
		const limit = new Error('Rate limit exceeded')
		vi.mocked(puppeteer.launch).mockImplementation(async () => {
			throw limit
		})
		const err = await caught(withBrowser(binding, async () => 'never'))
		expect(err).toMatchObject({
			status: 502,
			expose: false,
			code: 'BROWSER_LAUNCH_FAILED',
		})
		expect((err as Error).cause).toBe(limit)
	})

	it('screenshot loads the URL with viewport and wait options and returns the image', async () => {
		const { page, browser } = fakeBrowser()
		const png = await screenshot(
			binding,
			{ url: 'https://example.com' },
			{
				viewport: { width: 1200, height: 630 },
				waitUntil: 'networkidle0',
				timeout: 5000,
				screenshot: { fullPage: true },
			}
		)

		expect(png).toEqual(new Uint8Array([1]))
		expect(page.setViewport).toHaveBeenCalledWith({ width: 1200, height: 630 })
		expect(page.goto).toHaveBeenCalledWith('https://example.com', {
			waitUntil: 'networkidle0',
			timeout: 5000,
		})
		expect(page.screenshot).toHaveBeenCalledWith({ fullPage: true })
		expect(browser.close).toHaveBeenCalledOnce()
	})

	it('pdf sets HTML content and passes the PDF options', async () => {
		const { page } = fakeBrowser()
		expect(await pdf(binding, { html: '<h1>Hi</h1>' }, { pdf: { format: 'A4' } })).toEqual(
			new Uint8Array([2])
		)
		expect(page.setContent).toHaveBeenCalledWith('<h1>Hi</h1>', {
			waitUntil: undefined,
			timeout: undefined,
		})
		expect(page.goto).not.toHaveBeenCalled()
		expect(page.pdf).toHaveBeenCalledWith({ format: 'A4' })
	})

	it.each(['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hi', 'not a url'])(
		'rejects %j before launching',
		async (url) => {
			fakeBrowser()
			const err = await caught(screenshot(binding, { url }))
			expect(err).toMatchObject({ status: 400, expose: true, code: 'BROWSER_INVALID_URL' })
			expect(puppeteer.launch).not.toHaveBeenCalled()
		}
	)

	it('maps a failed navigation to BROWSER_RENDER_FAILED and still closes', async () => {
		const timeout = new Error('Navigation timeout of 5000 ms exceeded')
		const { browser } = fakeBrowser({ goto: vi.fn(async () => Promise.reject(timeout)) })
		const err = await caught(pdf(binding, { url: 'https://example.com' }))
		expect(err).toMatchObject({
			status: 502,
			expose: false,
			code: 'BROWSER_RENDER_FAILED',
		})
		expect((err as Error).cause).toBe(timeout)
		expect(browser.close).toHaveBeenCalledOnce()
	})
})
