import { CloudflareError } from '../errors/index.js'

/** Cloudflare's v4 REST API. */
const API_URL = 'https://api.cloudflare.com/client/v4'
/** Cloudflare Images' default delivery host. */
const DELIVERY_URL = 'https://imagedelivery.net'

/**
 * Resize and format options, written into a flexible variant or a
 * `/cdn-cgi/image/` URL as `key=value` pairs. The names and values are the ones
 * `fetch(url, { cf: { image } })` takes, limited to those a URL can carry, plus
 * `format: 'auto'` and `gravity: { x, y }` (sent as `0.5x0.5`).
 */
export type ImageOptions = Pick<
	RequestInitCfPropertiesImage,
	| 'width'
	| 'height'
	| 'fit'
	| 'quality'
	| 'dpr'
	| 'zoom'
	| 'sharpen'
	| 'blur'
	| 'rotate'
	| 'flip'
	| 'background'
	| 'brightness'
	| 'contrast'
	| 'gamma'
	| 'saturation'
	| 'anim'
	| 'metadata'
	| 'segment'
	| 'upscale'
> & {
	format?: RequestInitCfPropertiesImage['format'] | 'auto'
	gravity?: Exclude<BasicImageTransformations['gravity'], object> | { x: number; y: number }
}

/** The fields Cloudflare returns for an uploaded image. */
export interface ImageDetails {
	id: string
	filename?: string
	uploaded: string
	requireSignedURLs: boolean
	/** One delivery URL per named variant. */
	variants: string[]
	meta?: Record<string, unknown>
}

/** Options shared by {@link ImagesApi.upload} and {@link ImagesApi.directUpload}. */
export interface UploadOptions {
	/** A custom image id (it may contain `/`). Omit it and Cloudflare generates one. */
	id?: string
	/** Arbitrary JSON stored with the image. */
	metadata?: Record<string, unknown>
	/** Only deliver this image through signed URLs (see {@link signImageUrl}). */
	requireSignedURLs?: boolean
}

export interface ImagesApi {
	/**
	 * Upload an image from a `Blob`/`File`, or have Cloudflare fetch it from a
	 * URL string. `filename` names a `Blob` upload.
	 */
	upload(
		file: Blob | string,
		options?: UploadOptions & { filename?: string }
	): Promise<ImageDetails>
	/**
	 * Reserve a one-time upload URL, so a browser can POST the file (as the
	 * `file` form field) straight to Cloudflare without seeing your token.
	 * `expiry` must be 2 minutes to 6 hours ahead (Cloudflare's default is 30
	 * minutes).
	 */
	directUpload(
		options?: UploadOptions & { expiry?: Date }
	): Promise<{ id: string; uploadURL: string }>
}

interface Envelope {
	success?: boolean
	errors?: { code: number; message: string }[]
	result?: unknown
}

const invalidId = () =>
	new CloudflareError('Invalid Cloudflare Images id', { status: 400, code: 'IMAGES_INVALID_ID' })

// encodeURIComponent leaves `.` alone and URL parsing resolves dot segments, so
// an id of `.` or `..` (also percent-encoded) would point at another path.
const DOT_SEGMENT = /^(\.|%2e){1,2}$/i

/** Encode an id for a URL path, keeping `/` (custom image ids may contain it). */
function encodePath(id: string): string {
	const parts = id.split('/')
	if (!id || parts.some((p) => !p || DOT_SEGMENT.test(p))) throw invalidId()
	return parts.map(encodeURIComponent).join('/')
}

/** Serialize {@link ImageOptions} to `key=value,…`, skipping unset keys. */
export function imageOptions(options: ImageOptions): string {
	return Object.entries(options)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => {
			const v =
				typeof value === 'object'
					? `${(value as { x: number }).x}x${(value as { y: number }).y}`
					: String(value)
			return `${key}=${encodeURIComponent(v)}`
		})
		.join(',')
}

/**
 * Build an image's delivery URL from a named variant (`'public'`) or flexible
 * variant options (`{ width: 400, format: 'auto' }`, which must be enabled for
 * the account). Pass `origin` to deliver from your own zone through
 * `/cdn-cgi/imagedelivery/`. A `.`/`..` or empty id segment throws an exposed
 * 400 `IMAGES_INVALID_ID`.
 *
 * @example
 * imageUrl({ accountHash, imageId: 'avatars/ada', variant: { width: 128, fit: 'cover' } })
 * // https://imagedelivery.net/<accountHash>/avatars/ada/width=128,fit=cover
 */
export function imageUrl(options: {
	accountHash: string
	imageId: string
	variant: string | ImageOptions
	origin?: string
}): string {
	const { accountHash, imageId, variant, origin } = options
	const base = origin ? `${origin.replace(/\/+$/, '')}/cdn-cgi/imagedelivery` : DELIVERY_URL
	const tail = typeof variant === 'string' ? encodePath(variant) : imageOptions(variant)
	return `${base}/${encodePath(accountHash)}/${encodePath(imageId)}/${tail}`
}

/**
 * Build a `/cdn-cgi/image/<options>/<source>` URL, which resizes any image
 * (not only ones stored in Images) on a zone with Image Transformations on.
 * `source` is a path on the same zone or an absolute URL; `origin` defaults to
 * none, giving a root-relative URL.
 *
 * @example
 * transformUrl('/uploads/cat.jpg', { width: 800, quality: 80, format: 'auto' })
 * // /cdn-cgi/image/width=800,quality=80,format=auto/uploads/cat.jpg
 */
export function transformUrl(source: string, options: ImageOptions, origin = ''): string {
	return `${origin.replace(/\/+$/, '')}/cdn-cgi/image/${imageOptions(options)}/${source.replace(/^\/+/, '')}`
}

/**
 * Sign a delivery URL for an image that requires signed URLs: adds `exp` (now +
 * `expiresIn` seconds, default 1 hour) and `sig`, an HMAC-SHA256 of the path and
 * query keyed with the account's Images signing key. Signed delivery works
 * with named variants only; flexible variants are refused for such images.
 * Keep the key in `wrangler secret put`.
 *
 * @example
 * const url = await signImageUrl(imageUrl({ accountHash, imageId, variant: 'public' }), key)
 */
export async function signImageUrl(
	url: string,
	key: string,
	options: { expiresIn?: number } = {}
): Promise<string> {
	const signed = new URL(url)
	const exp = Math.floor(Date.now() / 1000) + (options.expiresIn ?? 3600)
	signed.searchParams.set('exp', String(exp))
	const enc = new TextEncoder()
	const hmac = await crypto.subtle.importKey(
		'raw',
		enc.encode(key),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	)
	const mac = await crypto.subtle.sign(
		'HMAC',
		hmac,
		enc.encode(`${signed.pathname}?${signed.searchParams}`)
	)
	const sig = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
	signed.searchParams.set('sig', sig)
	return signed.toString()
}

/**
 * A client for the Cloudflare Images upload API, authenticated with an API
 * token that has Images Write. Every failure (non-2xx, `success: false`, a
 * non-JSON body, a network error) throws a non-exposed 502 {@link CloudflareError}
 * with code `IMAGES_API_ERROR`; the upstream status and `errors` are on `cause`.
 * The token never appears in the error.
 *
 * @example
 * const images = createImagesApi({ accountId, token: requireEnv(env, 'IMAGES_TOKEN') })
 * const { uploadURL } = await images.directUpload({ metadata: { user: 'u_1' } })
 */
export function createImagesApi(options: { accountId: string; token: string }): ImagesApi {
	const { token } = options

	async function post(path: string, form: FormData): Promise<unknown> {
		const url = `${API_URL}/accounts/${encodePath(options.accountId)}/images/${path}`
		const fail = (status: number | string, detail: string | undefined, cause: unknown) =>
			new CloudflareError(
				`Cloudflare Images ${path} failed (${status}): ${detail ?? 'no detail'}`,
				{
					status: 502,
					expose: false,
					code: 'IMAGES_API_ERROR',
					cause,
				}
			)

		let res: Response
		try {
			res = await fetch(url, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: form,
			})
		} catch (err) {
			throw fail('network', err instanceof Error ? err.message : undefined, err)
		}
		let envelope: Envelope | undefined
		try {
			envelope = (await res.json()) as Envelope
		} catch {
			// Not JSON, e.g. an HTML error page from the edge.
		}
		const errors = Array.isArray(envelope?.errors) ? envelope.errors : []
		if (!res.ok || !envelope?.success) {
			throw fail(res.status, errors[0]?.message, { status: res.status, errors })
		}
		return envelope.result
	}

	function formFor(opts: UploadOptions): FormData {
		const form = new FormData()
		if (opts.id !== undefined) form.set('id', opts.id)
		if (opts.metadata !== undefined) form.set('metadata', JSON.stringify(opts.metadata))
		if (opts.requireSignedURLs !== undefined) {
			form.set('requireSignedURLs', String(opts.requireSignedURLs))
		}
		return form
	}

	return {
		async upload(file, opts = {}) {
			const form = formFor(opts)
			if (typeof file === 'string') form.set('url', file)
			else form.set('file', file, opts.filename)
			return (await post('v1', form)) as ImageDetails
		},
		async directUpload(opts = {}) {
			const form = formFor(opts)
			if (opts.expiry) form.set('expiry', opts.expiry.toISOString())
			return (await post('v2/direct_upload', form)) as { id: string; uploadURL: string }
		},
	}
}
