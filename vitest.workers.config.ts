import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

// Realistic binding tests: these run against workerd + Miniflare, so KV/R2/D1
// behave for real (TTL, list pagination, SQL) instead of being mocked. Opt a
// suite in by naming it `*.workers.test.ts`; pure-logic suites stay on the node
// runner (vitest.config.ts). Run with `pnpm test:workers`.
export default defineConfig({
	plugins: [
		cloudflareTest({
			miniflare: {
				// workerd needs a compatibility date; keep it in step with the
				// example Worker's wrangler.jsonc.
				compatibilityDate: '2026-06-26',
				kvNamespaces: ['TEST_KV'],
				r2Buckets: ['TEST_R2'],
				d1Databases: ['TEST_D1'],
			},
		}),
	],
	test: {
		include: ['src/**/*.workers.test.ts'],
	},
})
