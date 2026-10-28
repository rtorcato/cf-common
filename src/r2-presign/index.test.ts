import { describe, expect, it } from 'vitest'
import { CloudflareError } from '../errors/index'
import { presignR2Url, signQuery } from './index'

const ACCOUNT = '0123456789abcdef0123456789abcdef'
const base = {
	accountId: ACCOUNT,
	accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
	secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
	bucket: 'uploads',
	key: 'a.txt',
	date: new Date('2013-05-24T00:00:00Z'),
}

describe('signQuery', () => {
	// AWS's worked example: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
	it('matches the AWS SigV4 presigned URL example', async () => {
		const url = await signQuery({
			method: 'GET',
			host: 'examplebucket.s3.amazonaws.com',
			path: '/test.txt',
			region: 'us-east-1',
			accessKeyId: base.accessKeyId,
			secretAccessKey: base.secretAccessKey,
			expiresIn: 86400,
			date: base.date,
		})
		expect(url).toBe(
			'https://examplebucket.s3.amazonaws.com/test.txt' +
				'?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
				'&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
				'&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host' +
				'&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'
		)
	})
})

describe('presignR2Url', () => {
	it('signs a path-style URL on the account endpoint with region auto', async () => {
		const url = new URL(await presignR2Url(base))
		expect(url.host).toBe(`${ACCOUNT}.r2.cloudflarestorage.com`)
		expect(url.pathname).toBe('/uploads/a.txt')
		expect(url.searchParams.get('X-Amz-Credential')).toBe(
			'AKIAIOSFODNN7EXAMPLE/20130524/auto/s3/aws4_request'
		)
		expect(url.searchParams.get('X-Amz-Expires')).toBe('3600')
		expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
	})

	it('signs GET and PUT differently', async () => {
		const get = await presignR2Url(base)
		const put = await presignR2Url({ ...base, method: 'PUT' })
		expect(get).not.toBe(put)
	})

	it('keeps / between key segments and RFC 3986-encodes the rest', async () => {
		const url = await presignR2Url({ ...base, key: 'dir/my file (1)!.txt', expiresIn: 60 })
		expect(url).toContain('/uploads/dir/my%20file%20%281%29%21.txt?')
	})

	it.each([0, -1, 1.5, 604_801])('rejects expiresIn %s', async (expiresIn) => {
		await expect(presignR2Url({ ...base, expiresIn })).rejects.toMatchObject({
			status: 500,
			code: 'R2_PRESIGN_INVALID',
		})
	})

	it('rejects an account id that is not 32 hex characters', async () => {
		const err = await presignR2Url({ ...base, accountId: 'evil.example.com/x' }).catch((e) => e)
		expect(err).toBeInstanceOf(CloudflareError)
		expect(err.expose).toBe(false)
	})

	it.each(['', '.', '..', 'a/../b', 'a/./b'])('rejects key %j with an exposed 400', async (key) => {
		await expect(presignR2Url({ ...base, key })).rejects.toMatchObject({
			status: 400,
			expose: true,
			code: 'R2_PRESIGN_INVALID_KEY',
		})
	})
})
