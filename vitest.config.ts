import base from '@rtorcato/repo-tooling/vitest/config'
import { defineConfig, mergeConfig } from 'vitest/config'

// The preset supplies globals, the node environment, vitest's default
// excludes and coverage; mergeConfig concatenates the arrays below onto it.
export default mergeConfig(
	base,
	defineConfig({
		test: {
			setupFiles: ['./vitest.setup.ts'],
			// Library tests live in src/. apps/* (docs) own their runners (Playwright).
			include: ['src/**/*.{test,spec}.ts'],
			// `*.workers.test.ts` run on the workerd pool (vitest.workers.config.ts),
			// not this node runner.
			exclude: ['src/**/*.workers.test.ts'],
		},
	})
)
