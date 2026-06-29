import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		setupFiles: ['./vitest.setup.ts'],
		// Library tests live in src/. apps/* (docs) own their runners (Playwright).
		include: ['src/**/*.{test,spec}.ts'],
	},
})
