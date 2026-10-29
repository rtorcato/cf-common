import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { accessJwt, verifyAccessJwt } from './index'

const enc = (v: unknown) =>
	btoa(typeof v === 'string' ? v : JSON.stringify(v))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
const algo = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }

async function makeKey(kid: string) {
	const pair = (await crypto.subtle.generateKey(
		{ ...algo, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
		true,
		['sign', 'verify']
	)) as CryptoKeyPair
	const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid, alg: 'RS256' }
	return { priv: pair.privateKey, jwk }
}

async function sign(
	priv: CryptoKey,
	claims: Record<string, unknown>,
	header: Record<string, unknown> = { alg: 'RS256', kid: 'k1' }
) {
	const body = `${enc(header)}.${enc(claims)}`
	const sig = await crypto.subtle.sign(algo, priv, new TextEncoder().encode(body))
	return `${body}.${enc(String.fromCharCode(...new Uint8Array(sig)))}`
}

const now = () => Math.floor(Date.now() / 1000)
const aud = 'aud-tag'
// Each test uses its own team so the module's JWKS cache can't leak between them.
let n = 0
const newTeam = () => `team${++n}.cloudflareaccess.com`
const goodClaims = (team: string) => ({
	aud: [aud],
	iss: `https://${team}`,
	sub: 'user-1',
	email: 'a@b.dev',
	iat: now(),
	exp: now() + 300,
})

let k1: Awaited<ReturnType<typeof makeKey>>
beforeAll(async () => {
	k1 = await makeKey('k1')
})
afterEach(() => vi.unstubAllGlobals())

function stubCerts(keys: unknown[], status = 200) {
	const fetchMock = vi.fn(async () => Response.json({ keys }, { status }))
	vi.stubGlobal('fetch', fetchMock)
	return fetchMock
}

describe('verifyAccessJwt', () => {
	it('returns the identity for a valid token and caches the JWKS', async () => {
		const team = newTeam()
		const certs = stubCerts([k1.jwk])
		const token = await sign(k1.priv, goodClaims(team))
		const id = await verifyAccessJwt(token, { teamDomain: team, aud })
		expect(id.email).toBe('a@b.dev')
		await verifyAccessJwt(token, { teamDomain: `https://${team}/`, aud })
		expect(certs).toHaveBeenCalledTimes(1)
		expect(certs).toHaveBeenCalledWith(`https://${team}/cdn-cgi/access/certs`)
	})

	it.each([
		['expired', (t: string) => ({ ...goodClaims(t), exp: now() - 10 })],
		['not yet valid', (t: string) => ({ ...goodClaims(t), nbf: now() + 600 })],
		['wrong audience', (t: string) => ({ ...goodClaims(t), aud: ['other'] })],
		['wrong issuer', () => ({ ...goodClaims('evil.example.com') })],
	])('rejects a %s token with a 401', async (_name, claims) => {
		const team = newTeam()
		stubCerts([k1.jwk])
		const token = await sign(k1.priv, claims(team))
		await expect(verifyAccessJwt(token, { teamDomain: team, aud })).rejects.toMatchObject({
			status: 401,
			code: 'ACCESS_JWT_INVALID',
		})
	})

	it('rejects a token signed by a different key', async () => {
		const team = newTeam()
		stubCerts([k1.jwk])
		const attacker = await makeKey('k1')
		const token = await sign(attacker.priv, goodClaims(team))
		await expect(verifyAccessJwt(token, { teamDomain: team, aud })).rejects.toMatchObject({
			code: 'ACCESS_JWT_INVALID',
		})
	})

	it('rejects alg=none, malformed tokens and unknown kids', async () => {
		const team = newTeam()
		stubCerts([k1.jwk])
		const none = `${enc({ alg: 'none', kid: 'k1' })}.${enc(goodClaims(team))}.`
		for (const bad of [
			none,
			'garbage',
			'a.b.c',
			await sign(k1.priv, goodClaims(team), { alg: 'RS256', kid: 'nope' }),
		]) {
			await expect(verifyAccessJwt(bad, { teamDomain: team, aud })).rejects.toMatchObject({
				status: 401,
			})
		}
	})

	it('refetches the JWKS once when the kid is unknown and the cache is stale', async () => {
		vi.useFakeTimers()
		try {
			const team = newTeam()
			const k2 = await makeKey('k2')
			const certs = stubCerts([k1.jwk])
			await verifyAccessJwt(await sign(k1.priv, goodClaims(team)), { teamDomain: team, aud })
			certs.mockImplementation(async () => Response.json({ keys: [k1.jwk, k2.jwk] }))
			vi.advanceTimersByTime(61_000)
			const token = await sign(
				k2.priv,
				{ ...goodClaims(team), exp: now() + 300 },
				{ alg: 'RS256', kid: 'k2' }
			)
			await expect(verifyAccessJwt(token, { teamDomain: team, aud })).resolves.toBeTruthy()
			expect(certs).toHaveBeenCalledTimes(2)
		} finally {
			vi.useRealTimers()
		}
	})

	it('throws a non-exposed 502 when the certs endpoint fails', async () => {
		const team = newTeam()
		stubCerts([], 500)
		const token = await sign(k1.priv, goodClaims(team))
		await expect(verifyAccessJwt(token, { teamDomain: team, aud })).rejects.toMatchObject({
			status: 502,
			expose: false,
			code: 'ACCESS_JWKS_HTTP_ERROR',
		})
	})
})

describe('accessJwt', () => {
	it('reads the assertion header, or null when absent', () => {
		expect(
			accessJwt(new Request('https://x.dev', { headers: { 'Cf-Access-Jwt-Assertion': ' tok ' } }))
		).toBe('tok')
		expect(accessJwt(new Request('https://x.dev'))).toBeNull()
	})
})
