import { CloudflareError } from '../errors/index.js'

/**
 * Verify the `Cf-Access-Jwt-Assertion` header Cloudflare Access adds to requests
 * behind Zero Trust, so a Worker can trust the identity it carries. Web Crypto
 * only: RS256 against the team's published JWKS, no JWT library.
 */

/** Claims Cloudflare Access puts in the assertion. Other claims pass through. */
export interface AccessIdentity {
	/** The Access application AUD tag(s) the token was issued for. */
	aud: string[]
	/** The authenticated user's email (absent for service tokens). */
	email?: string
	/** Issuer, `https://<team>.cloudflareaccess.com`. */
	iss: string
	/** Stable user id. */
	sub: string
	iat: number
	exp: number
	nbf?: number
	/** `app` for a user, `service-token` for a service token. */
	type?: string
	country?: string
	[claim: string]: unknown
}

export interface VerifyAccessJwtOptions {
	/** Your Access team domain, e.g. `myteam.cloudflareaccess.com`. */
	teamDomain: string
	/** The application's AUD tag, from the Access application's settings. */
	aud: string
}

interface Jwk extends JsonWebKey {
	kid?: string
}

const HEADER = 'Cf-Access-Jwt-Assertion'
/** Cloudflare rotates signing keys every ~6 weeks; an hour is a safe cache. */
const JWKS_TTL_MS = 60 * 60 * 1000
/** Floor between forced refetches for an unknown `kid`, so junk tokens can't hammer the certs endpoint. */
const JWKS_REFETCH_MS = 60 * 1000

// ponytail: per-isolate cache; a cold isolate refetches. Move to the Cache API if cold starts matter.
const cache = new Map<string, { keys: Jwk[]; fetchedAt: number }>()

/**
 * Read the Access assertion from a request. `null` when the header is missing,
 * i.e. the request didn't come through Access.
 *
 * @example
 * const token = accessJwt(request)
 */
export function accessJwt(request: Request): string | null {
	return request.headers.get(HEADER)?.trim() || null
}

/**
 * Verify an Access JWT and return its claims. Checks the RS256 signature
 * against the team JWKS, the issuer, the `aud` tag, `exp` and `nbf`. Throws a
 * `401` {@link CloudflareError} (`ACCESS_JWT_INVALID`) for any bad token, and a
 * non-exposed `502` (`ACCESS_JWKS_HTTP_ERROR`) if the JWKS can't be fetched.
 *
 * @example
 * const token = accessJwt(request)
 * if (!token) throw new CloudflareError('Unauthorized', { status: 401 })
 * const { email } = await verifyAccessJwt(token, { teamDomain: env.TEAM_DOMAIN, aud: env.POLICY_AUD })
 */
export async function verifyAccessJwt(
	token: string,
	{ teamDomain, aud }: VerifyAccessJwtOptions
): Promise<AccessIdentity> {
	const team = teamDomain.replace(/^https:\/\//, '').replace(/\/+$/, '')
	const parts = token.split('.')
	if (parts.length !== 3) throw invalid('Malformed token')
	const [h, p, s] = parts as [string, string, string]

	const { alg, kid } = decodeJson(h) as { alg?: unknown; kid?: unknown }
	if (alg !== 'RS256' || typeof kid !== 'string') throw invalid('Unsupported token header')

	const jwk = await findKey(team, kid)
	const key = await crypto.subtle.importKey(
		'jwk',
		jwk,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['verify']
	)
	const data = new TextEncoder().encode(`${h}.${p}`)
	let signature: Uint8Array<ArrayBuffer>
	try {
		signature = base64UrlDecode(s)
	} catch (cause) {
		throw invalid('Malformed token', cause)
	}
	if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data))) {
		throw invalid('Bad signature')
	}

	const claims = decodeJson(p) as AccessIdentity
	const now = Math.floor(Date.now() / 1000)
	if (claims.iss !== `https://${team}`) throw invalid('Wrong issuer')
	const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
	if (!audiences.includes(aud)) throw invalid('Wrong audience')
	if (typeof claims.exp !== 'number' || claims.exp <= now) throw invalid('Token expired')
	if (typeof claims.nbf === 'number' && claims.nbf > now) throw invalid('Token not yet valid')
	return { ...claims, aud: audiences }
}

function invalid(message: string, cause?: unknown): CloudflareError {
	return new CloudflareError(`Invalid Access token: ${message}`, {
		status: 401,
		code: 'ACCESS_JWT_INVALID',
		cause,
	})
}

async function findKey(team: string, kid: string): Promise<Jwk> {
	let entry = cache.get(team)
	const age = entry ? Date.now() - entry.fetchedAt : Number.POSITIVE_INFINITY
	// Fetch when cold or stale, or once a minute at most when the kid is unknown (key rotation).
	const known = entry?.keys.some((k) => k.kid === kid)
	if (!entry || age > JWKS_TTL_MS || (!known && age > JWKS_REFETCH_MS)) {
		entry = { keys: await fetchJwks(team), fetchedAt: Date.now() }
		cache.set(team, entry)
	}
	const jwk = entry.keys.find((k) => k.kid === kid)
	if (!jwk) throw invalid('Unknown signing key')
	return jwk
}

async function fetchJwks(team: string): Promise<Jwk[]> {
	const res = await fetch(`https://${team}/cdn-cgi/access/certs`)
	if (!res.ok) {
		throw new CloudflareError(`Access certs endpoint returned ${res.status}`, {
			status: 502,
			code: 'ACCESS_JWKS_HTTP_ERROR',
		})
	}
	return (await res.json<{ keys: Jwk[] }>()).keys
}

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
	const b64 = input
		.replace(/-/g, '+')
		.replace(/_/g, '/')
		.padEnd(Math.ceil(input.length / 4) * 4, '=')
	return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

function decodeJson(segment: string): Record<string, unknown> {
	try {
		const value: unknown = JSON.parse(new TextDecoder().decode(base64UrlDecode(segment)))
		if (value && typeof value === 'object' && !Array.isArray(value))
			return value as Record<string, unknown>
	} catch (cause) {
		throw invalid('Malformed token', cause)
	}
	throw invalid('Malformed token')
}
