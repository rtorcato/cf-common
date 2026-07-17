import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		setupFiles: ['./vitest.setup.ts'],
		// Library tests live in src/. apps/* (docs) own their runners (Playwright).
		include: ['src/**/*.{test,spec}.ts'],
		// `*.workers.test.ts` run on the workerd pool (vitest.workers.config.ts),
		// not this node runner.
		exclude: [...configDefaults.exclude, 'src/**/*.workers.test.ts'],
	},
})
