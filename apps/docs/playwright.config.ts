import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for the cf-common docs site.
 *
 * Boots the production build via `pnpm serve` (port 3000) — closer to GitHub
 * Pages than the dev server and free of HMR flake. Two projects: mobile
 * (drawer behavior) and desktop.
 */

const PORT = 3000
const BASE_URL = `http://localhost:${PORT}/cf-common/`

export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: BASE_URL,
		colorScheme: 'dark',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},
	projects: [
		{
			name: 'mobile',
			use: { ...devices['Pixel 7'] },
		},
		{
			name: 'desktop',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
		},
	],
	webServer: {
		command: `pnpm run build && pnpm run serve --port ${PORT}`,
		url: BASE_URL,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
		stdout: 'ignore',
		stderr: 'pipe',
	},
})
