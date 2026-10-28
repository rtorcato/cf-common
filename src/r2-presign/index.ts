import { hashString } from '@rtorcato/js-common/crypto'
import { CloudflareError } from '../errors/index.js'

/** SigV4 caps a presigned URL at 7 days. */
const MAX_EXPIRES_IN = 604_800

/** Options for {@link presignR2Url}. */
export interface R2PresignOptions {
	/** Your Cloudflare account id (32 hex characters). */
	accountId: string
	/** An R2 API token's access key id. */
	accessKeyId: string
	/** An R2 API token's secret access key. Keep it in a secret, never a var. */
	secretAccessKey: string
	bucket: string
	/** The object key. `/` separates path segments; `.` and `..` segments are rejected. */
	key: string
	/** `GET` to download, `PUT` to upload. Defaults to `GET`. */
	method?: 'GET' | 'PUT'
	/** Seconds the URL stays valid, from 1 to 604800 (7 days). Defaults to 3600. */
	expiresIn?: number
	/** The signing time. Defaults to now. */
	date?: Date
}

/**
 * Sign a presigned `GET` or `PUT` URL for an R2 object, over R2's S3-compatible
 * endpoint (`<accountId>.r2.cloudflarestorage.com`). Anyone holding the URL can
 * download or upload that one object until it expires, with no other credentials.
 *
 * R2 bindings can't do this: it needs an R2 API token's access key and secret,
 * and AWS SigV4 signing, done here with Web Crypto (no dependency).
 *
 * Only the `host` header is signed, so a `PUT` client may send any
 * `Content-Type`. Throws a non-exposed 500 `R2_PRESIGN_INVALID` for a bad
 * `accountId` or `expiresIn`, and an exposed 400 `R2_PRESIGN_INVALID_KEY` for an
 * empty key or one with a `.` or `..` segment, since keys often come from users.
 *
 * @example
 * const url = await presignR2Url({
 *   accountId: requireEnv(env, 'R2_ACCOUNT_ID'),
 *   accessKeyId: requireEnv(env, 'R2_ACCESS_KEY_ID'),
 *   secretAccessKey: requireEnv(env, 'R2_SECRET_ACCESS_KEY'),
 *   bucket: 'uploads',
 *   key: `avatars/${userId}.png`,
 *   method: 'PUT',
 *   expiresIn: 300,
 * })
 */
export async function presignR2Url(options: R2PresignOptions): Promise<string> {
	const { accountId, bucket, key, expiresIn = 3600 } = options
	if (!/^[0-9a-f]{32}$/i.test(accountId)) {
		throw new CloudflareError('accountId must be 32 hex characters', { code: 'R2_PRESIGN_INVALID' })
	}
	if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > MAX_EXPIRES_IN) {
		throw new CloudflareError(`expiresIn must be an integer from 1 to ${MAX_EXPIRES_IN}`, {
			code: 'R2_PRESIGN_INVALID',
		})
	}
	const segments = key.split('/')
	// A client that skips URL normalization could send `/bucket/../other/x` with a
	// valid signature, so refuse keys that could walk out of the bucket.
	if (!key || segments.some((s) => s === '.' || s === '..')) {
		throw new CloudflareError('Invalid object key', { status: 400, code: 'R2_PRESIGN_INVALID_KEY' })
	}
	return signQuery({
		method: options.method ?? 'GET',
		host: `${accountId}.r2.cloudflarestorage.com`,
		path: `/${[bucket, ...segments].map(encode).join('/')}`,
		region: 'auto',
		accessKeyId: options.accessKeyId,
		secretAccessKey: options.secretAccessKey,
		expiresIn,
		date: options.date ?? new Date(),
	})
}

/**
 * SigV4 query-string signing for S3 (`host` signed, `UNSIGNED-PAYLOAD`). `path`
 * must already be URI-encoded.
 *
 * @internal Exported only so tests can check it against AWS's published example.
 */
export async function signQuery(req: {
	method: string
	host: string
	path: string
	region: string
	accessKeyId: string
	secretAccessKey: string
	expiresIn: number
	date: Date
}): Promise<string> {
	const amzDate = req.date.toISOString().replace(/[-:]|\.\d{3}/g, '') // 20130524T000000Z
	const day = amzDate.slice(0, 8)
	const scope = `${day}/${req.region}/s3/aws4_request`
	const query = (
		[
			['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
			['X-Amz-Credential', `${req.accessKeyId}/${scope}`],
			['X-Amz-Date', amzDate],
			['X-Amz-Expires', String(req.expiresIn)],
			['X-Amz-SignedHeaders', 'host'],
		] as const
	)
		.map(([k, v]) => `${encode(k)}=${encode(v)}`)
		.join('&') // already in sorted key order
	const canonical = [
		req.method,
		req.path,
		query,
		`host:${req.host}`,
		'',
		'host',
		'UNSIGNED-PAYLOAD',
	]
	const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await hashString(canonical.join('\n'))]

	let key: BufferSource = new TextEncoder().encode(`AWS4${req.secretAccessKey}`)
	for (const part of [day, req.region, 's3', 'aws4_request', toSign.join('\n')]) {
		key = await hmac(key, part)
	}
	const signature = Array.from(new Uint8Array(key as ArrayBuffer), (b) =>
		b.toString(16).padStart(2, '0')
	).join('')
	return `https://${req.host}${req.path}?${query}&X-Amz-Signature=${signature}`
}

async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
	const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
	])
	return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))
}

/** RFC 3986 encoding, as SigV4 requires (`encodeURIComponent` leaves `!'()*`). */
function encode(s: string): string {
	return encodeURIComponent(s).replace(
		/[!'()*]/g,
		(c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
	)
}
