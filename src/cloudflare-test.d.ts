// Ambient types for the `cloudflare:test` module the vitest workers pool injects
// at runtime (see vitest.workers.config.ts). The pool package ships fuller types
// behind a subpath export, but tsc resolves this local declaration without extra
// wiring — and the `*.workers.test.ts` suites only need `env`.
// ponytail: declare only what the workers tests use (env + the 3 test bindings);
// add SELF/fetchMock/etc. here if a suite needs them.
declare module 'cloudflare:test' {
	export const env: {
		TEST_KV: KVNamespace
		TEST_R2: R2Bucket
		TEST_D1: D1Database
	}
}
