import { describe, expect, it, vi } from 'vitest'
import { isCloudflareError } from '../errors/index'
import { sendEmail } from './index'

// A stand-in for the send_email binding: only `send` is exercised.
function fakeMailer(send: (message: unknown) => unknown) {
	return { send: vi.fn(async (message: unknown) => send(message)) } as unknown as SendEmail
}

describe('email module', () => {
	it('sendEmail passes the message to the binding and returns its result', async () => {
		const mailer = fakeMailer(() => ({ messageId: 'msg-1' }))
		const message = {
			from: { name: 'App', email: 'noreply@example.com' },
			to: 'user@example.com',
			subject: 'Welcome',
			text: 'Thanks for signing up.',
		}

		const out = await sendEmail(mailer, message)

		expect(out).toEqual({ messageId: 'msg-1' })
		expect(mailer.send).toHaveBeenCalledWith(message)
	})

	it('sendEmail passes a raw EmailMessage through unchanged', async () => {
		const mailer = fakeMailer(() => ({ messageId: 'msg-2' }))
		// Stands in for `new EmailMessage(from, to, raw)` from cloudflare:email.
		const raw = { from: 'noreply@example.com', to: 'user@example.com' } as EmailMessage

		await sendEmail(mailer, raw)

		expect(mailer.send).toHaveBeenCalledWith(raw)
	})

	it('sendEmail maps a failed send to a non-exposed 502 and keeps the cause', async () => {
		const upstream = new Error('destination address not verified: user@example.com')
		const mailer = fakeMailer(() => Promise.reject(upstream))

		try {
			await sendEmail(mailer, {
				from: 'a@example.com',
				to: 'user@example.com',
				subject: 'Hi',
				text: 'x',
			})
			expect.unreachable()
		} catch (err) {
			expect(isCloudflareError(err)).toBe(true)
			expect(isCloudflareError(err) && err.status).toBe(502)
			expect(isCloudflareError(err) && err.expose).toBe(false)
			expect(isCloudflareError(err) && err.code).toBe('EMAIL_SEND_FAILED')
			expect((err as Error).message).not.toContain('user@example.com')
			expect((err as Error).cause).toBe(upstream)
		}
	})
})
