import { expect, test } from '@playwright/test'

/**
 * Smoke tests — the landing renders, docs are reachable, and the mobile drawer
 * (swizzled PrimaryMenu) shows the flat menu and navigates.
 */

test('landing renders hero and install command', async ({ page }) => {
	await page.goto('/cf-common/')
	await expect(page).toHaveTitle(/cf-common/)
	await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible()
	await expect(page.getByText('npm install @rtorcato/cf-common')).toBeVisible()
})

test('docs overview loads', async ({ page }) => {
	await page.goto('/cf-common/docs')
	await expect(page.getByRole('heading', { name: 'cf-common', level: 1 })).toBeVisible()
	await expect(page.getByRole('link', { name: 'Getting started' }).first()).toBeVisible()
})

test.describe('mobile drawer', () => {
	test.skip(({ viewport }) => (viewport?.width ?? 0) > 996, 'mobile viewport only')

	test('opens with flat menu and navigates', async ({ page }) => {
		await page.goto('/cf-common/docs')

		const drawer = page.locator('.navbar-sidebar')
		await expect(drawer).toBeHidden()

		await page.getByRole('button', { name: /toggle navigation/i }).click()
		const menu = page.locator('.jc-mobile-menu')
		await expect(menu).toBeVisible()
		await expect(menu.getByRole('link', { name: 'Overview' })).toBeVisible()

		// No "Back to main menu" — SecondaryMenu is stubbed.
		await expect(page.locator('.navbar-sidebar__back')).toBeHidden()

		await menu.getByRole('link', { name: 'Getting started' }).click()
		await expect(page).toHaveURL(/\/docs\/guides\/getting-started\/?$/)
		await expect(drawer).toBeHidden()
	})
})
