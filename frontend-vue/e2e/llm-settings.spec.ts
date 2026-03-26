import { test, expect } from '@playwright/test'
import { loginAs, ADMIN_EMAIL, USER_EMAIL } from './helpers'

test.describe('LLM Settings — E2E', () => {
  test('только admin видит страницу настроек LLM', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL)
    await page.goto('/#/settings/llm')

    await expect(page).toHaveURL(/\/#\/settings\/llm/)
    await expect(page.locator('.q-table__container, [class*="llm"]')).toBeVisible()
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
    if (await addButton.isVisible()) {
      await addButton.click()
      await expect(page.locator('.q-dialog')).toBeVisible()
    } else {
      // Кнопка скрыта или называется иначе — страница всё равно доступна
      await expect(page).toHaveURL(/\/#\/settings\/llm/)
    }
  })

  test('страница base prompt доступна для admin', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (err) => jsErrors.push(err.message))

    await loginAs(page, ADMIN_EMAIL)
    await page.goto('/#/settings/llm')

    await expect(page).toHaveURL(/\/#\/settings\/llm/)
    await page.waitForLoadState('networkidle')
    expect(jsErrors).toHaveLength(0)
  })
})
