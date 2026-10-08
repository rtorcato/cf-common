import { describe, expect, it } from 'vitest'
import { rateLimit } from './index'

function fake(success = true) {
	const keys: string[] = []
	return {
		keys,
		binding: {
			async limit({ key }: { key: string }) {
				keys.push(key)
				return { success }
			},
		},
	}
}

describe('ratelimit module', () => {
	it('limit passes the key through and returns success', async () => {
		const f = fake(false)
		expect(await rateLimit(f.binding).limit({ key: 'a' })).toEqual({ success: false })
		expect(f.keys).toEqual(['a'])
	})

	it('limitByIp keys by CF-Connecting-IP, else unknown', async () => {
		const f = fake()
		const l = rateLimit(f.binding)
		await l.limitByIp(new Request('https://x', { headers: { 'CF-Connecting-IP': '1.2.3.4' } }))
		await l.limitByIp(new Request('https://x'))
		expect(f.keys).toEqual(['1.2.3.4', 'unknown'])
	})

	it('limitBy applies an optional prefix', async () => {
		const f = fake()
		const l = rateLimit(f.binding)
		await l.limitBy('u1')
		await l.limitBy('u1', 'login')
		expect(f.keys).toEqual(['u1', 'login:u1'])
	})
})
