import { CloudflareError } from '../errors/index.js'

/**
 * Send an email through a `send_email` binding. Pass the message as fields
 * (`from`, `to`, `subject`, `text`/`html`, `attachments`, …) and the runtime
 * builds the MIME for you, or pass an `EmailMessage` from `cloudflare:email`
 * when you already have raw MIME.
 *
 * A failed send (unverified sender or destination, a recipient the binding's
 * allow list rejects, a quota or upstream error) throws a non-exposed 502 with
 * code `EMAIL_SEND_FAILED` and the original error as `cause`. The detail names
 * addresses, so it stays in logs and out of the response.
 *
 * @example
 * const mailer = getBinding<SendEmail>(env, 'EMAIL')
 * const { messageId } = await sendEmail(mailer, {
 *   from: { name: 'App', email: 'noreply@example.com' },
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   text: 'Thanks for signing up.',
 * })
 */
export async function sendEmail(
	binding: SendEmail,
	message: EmailMessageBuilder | EmailMessage
): Promise<EmailSendResult> {
	try {
		// send() is overloaded per shape and TS can't pick an overload for a union.
		// The runtime takes either, so the cast only satisfies the compiler.
		return await binding.send(message as EmailMessageBuilder)
	} catch (cause) {
		throw new CloudflareError('Email send failed', {
			status: 502,
			expose: false,
			code: 'EMAIL_SEND_FAILED',
			cause,
		})
	}
}
