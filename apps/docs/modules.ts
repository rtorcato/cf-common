// One typedoc plugin instance per subpath module (docusaurus.config.ts), and one
// API Reference sidebar entry per module (sidebars.ts). Add a module here when it
// ships — that's the only edit needed; the API docs regenerate from source JSDoc
// on every build. The description is stamped into the page frontmatter so the
// API index cards describe each module instead of TypeDoc's generic "Functions"
// fallback.
export const MODULES: Record<string, string> = {
	errors: 'Typed CloudflareError model + result helpers.',
	env: 'Typed env access and getBinding helpers.',
	kv: 'Typed get/put/list with JSON + TTL helpers.',
	r2: 'Typed R2 object get/put/list with JSON helpers.',
	'r2-presign': 'Presigned R2 GET/PUT URLs via the S3 API and SigV4.',
	cache: 'Cache API match/put/delete with key builder and TTL.',
	d1: 'Typed query helpers and batch over D1.',
	request: 'Typed request.cf metadata, JSON body, bearer token and client IP.',
	ratelimit: 'Typed rate limiting by IP or arbitrary key.',
	http: 'defineFetch error mapping, error responses and CORS helpers.',
	turnstile: 'Verify or assert a Turnstile token server-side.',
	cron: 'Dispatch scheduled events to jobs by cron expression.',
	ai: 'Typed run() over the Workers AI binding, with error mapping.',
	queues: 'Typed Queue producer and a consumer that acks or retries each message.',
	hyperdrive: 'Per-request database client over a Hyperdrive binding, always closed.',
}
