import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createImagesApi, imageOptions, imageUrl, signImageUrl, transformUrl } from './index'

const TOKEN = 'images-token-123'
const API = 'https://api.cloudflare.com/client/v4/accounts/acct/images'

function stubFetch(respond: () => Response | Promise<Response>) {
	const calls: { url: string; init: RequestInit }[] = []
	vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
		calls.push({ url, init: init ?? {} })
		return respond()
	})
	return calls
}

const first = (calls: { url: string; init: RequestInit }[]) => {
	expect(calls).toHaveLength(1)
	return calls[0] as { url: string; init: RequestInit }
}

const ok = (result: unknown) => Response.json({ success: true, errors: [], result })

async function caught(promise: Promise<unknown>): Promise<unknown> {
	try {
		await promise
	} catch (err) {
		return err
	}
	expect.unreachable()
}

afterEach(() => {
	vi.unstubAllGlobals()
	vi.useRealTimers()
})

describe('images module', () => {
	it('imageOptions serializes set keys in order, encoding values', () => {
		expect(
			imageOptions({
				width: 400,
				fit: 'cover',
				format: 'auto',
				height: undefined,
				gravity: { x: 0.5, y: 0.25 },
				background: '#fff',
			})
		).toBe('width=400,fit=cover,format=auto,gravity=0.5x0.25,background=%23fff')
	})

	it('imageUrl builds named and flexible variant URLs, keeping / in ids', () => {
		expect(imageUrl({ accountHash: 'h', imageId: 'avatars/ada', variant: 'public' })).toBe(
			'https://imagedelivery.net/h/avatars/ada/public'
		)
		expect(imageUrl({ accountHash: 'h', imageId: 'a b', variant: { width: 128 } })).toBe(
			'https://imagedelivery.net/h/a%20b/width=128'
		)
		expect(
			imageUrl({ accountHash: 'h', imageId: 'i', variant: 'thumb', origin: 'https://example.com/' })
		).toBe('https://example.com/cdn-cgi/imagedelivery/h/i/thumb')
	})

	it.each(['..', 'a/../b', 'a/%2E', '', 'a//b'])('imageUrl rejects image id %j', (imageId) => {
		expect(() => imageUrl({ accountHash: 'h', imageId, variant: 'public' })).toThrow(
			expect.objectContaining({ status: 400, expose: true, code: 'IMAGES_INVALID_ID' })
		)
	})

	it('transformUrl builds a /cdn-cgi/image/ URL for a path or absolute source', () => {
		expect(transformUrl('/uploads/cat.jpg', { width: 800, quality: 80 })).toBe(
			'/cdn-cgi/image/width=800,quality=80/uploads/cat.jpg'
		)
		expect(transformUrl('https://other.com/a.png', { format: 'webp' }, 'https://example.com')).toBe(
			'https://example.com/cdn-cgi/image/format=webp/https://other.com/a.png'
		)
	})

	it('trims long slash runs from origin and source', () => {
		const slashes = '/'.repeat(100_000)
		expect(transformUrl(`${slashes}a.png`, { width: 1 }, `https://example.com${slashes}`)).toBe(
			'https://example.com/cdn-cgi/image/width=1/a.png'
		)
		expect(
			imageUrl({
				accountHash: 'h',
				imageId: 'i',
				variant: 'thumb',
				origin: `https://example.com${slashes}`,
			})
		).toBe('https://example.com/cdn-cgi/imagedelivery/h/i/thumb')
	})

	it('signImageUrl adds exp and an HMAC-SHA256 sig of the path and query', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
		const exp = Date.parse('2026-01-01T00:00:00Z') / 1000 + 60
		const url = await signImageUrl('https://imagedelivery.net/h/i/public?v=2', 'key', {
			expiresIn: 60,
		})

		const expected = createHmac('sha256', 'key').update(`/h/i/public?v=2&exp=${exp}`).digest('hex')
		expect(url).toBe(`https://imagedelivery.net/h/i/public?v=2&exp=${exp}&sig=${expected}`)
	})

	it('upload sends a Blob as the file field with options', async () => {
		const calls = stubFetch(() => ok({ id: 'i1', variants: [] }))
		const images = createImagesApi({ accountId: 'acct', token: TOKEN })
		const out = await images.upload(new Blob(['x'], { type: 'image/png' }), {
			id: 'avatars/ada',
			metadata: { user: 'u_1' },
			requireSignedURLs: true,
			filename: 'ada.png',
		})

		expect(out).toEqual({ id: 'i1', variants: [] })
		const call = first(calls)
		expect(call.url).toBe(`${API}/v1`)
		expect(call.init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` })
		const form = call.init.body as FormData
		expect(form.get('id')).toBe('avatars/ada')
		expect(form.get('metadata')).toBe('{"user":"u_1"}')
		expect(form.get('requireSignedURLs')).toBe('true')
		expect((form.get('file') as File).name).toBe('ada.png')
	})

	it('upload sends a string as the url field', async () => {
		const calls = stubFetch(() => ok({ id: 'i1' }))
		await createImagesApi({ accountId: 'acct', token: TOKEN }).upload('https://x.com/a.png')
		const form = first(calls).init.body as FormData
		expect(form.get('url')).toBe('https://x.com/a.png')
		expect(form.has('file')).toBe(false)
	})

	it('directUpload posts to v2/direct_upload with the expiry as ISO', async () => {
		const calls = stubFetch(() => ok({ id: 'i1', uploadURL: 'https://upload.imagedelivery.net/x' }))
		const out = await createImagesApi({ accountId: 'acct', token: TOKEN }).directUpload({
			expiry: new Date('2026-01-01T01:00:00Z'),
		})

		expect(out).toEqual({ id: 'i1', uploadURL: 'https://upload.imagedelivery.net/x' })
		const call = first(calls)
		expect(call.url).toBe(`${API}/v2/direct_upload`)
		expect((call.init.body as FormData).get('expiry')).toBe('2026-01-01T01:00:00.000Z')
	})

	it('maps API errors, non-JSON and network failures to IMAGES_API_ERROR', async () => {
		const images = createImagesApi({ accountId: 'acct', token: TOKEN })

		stubFetch(() =>
			Response.json(
				{ success: false, errors: [{ code: 5400, message: 'bad image' }] },
				{ status: 400 }
			)
		)
		const err = (await caught(images.upload('https://x.com/a.png'))) as Error & { cause: unknown }
		expect(err).toMatchObject({ status: 502, expose: false, code: 'IMAGES_API_ERROR' })
		expect(err.cause).toEqual({ status: 400, errors: [{ code: 5400, message: 'bad image' }] })
		expect(err.message).not.toContain(TOKEN)

		stubFetch(() => new Response('<html>', { status: 502 }))
		expect(await caught(images.directUpload())).toMatchObject({ code: 'IMAGES_API_ERROR' })

		vi.stubGlobal('fetch', async () => {
			throw new TypeError('connect failed')
		})
		expect(await caught(images.directUpload())).toMatchObject({ code: 'IMAGES_API_ERROR' })
	})

	it('rejects a dot-segment account id before sending', async () => {
		const calls = stubFetch(() => ok({}))
		const err = await caught(createImagesApi({ accountId: '..', token: TOKEN }).directUpload())
		expect(err).toMatchObject({ code: 'IMAGES_INVALID_ID' })
		expect(calls).toHaveLength(0)
	})
})
