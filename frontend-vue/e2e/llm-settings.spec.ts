import { test, expect } from '@playwright/test'
import { loginAs, ADMIN_EMAIL, USER_EMAIL } from '@/../e2e/helpers'

test.describe('LLM Settings — E2E', () => {
  test('только admin видит страницу настроек LLM', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (error) => jsErrors.push(error.message))

    await loginAs(page, ADMIN_EMAIL)
    await page.goto('/#/settings/llm')

    await expect(page).toHaveURL(/\/#\/settings\/llm/)
    await expect(page.locator('.q-table__container, [class*="llm"]')).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(jsErrors).toHaveLength(0)
  })

  test('не-admin перенаправляется с /settings/llm на /', async ({ page }) => {
    await loginAs(page, USER_EMAIL)
    await page.goto('/#/settings/llm')

    await expect(page).toHaveURL(/\/#\/$/)
  })

  test('форма создания LLM настройки открывается', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL)
    await page.goto('/#/settings/llm')

    const addButton = page.locator('button').filter({ hasText: /добавить|новый|add|new/i }).first()
    await addButton.waitFor({ timeout: 10_000 })
    await addButton.click()
    await expect(page.locator('.q-dialog')).toBeVisible()
  })
})
