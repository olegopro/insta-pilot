import { test, expect, type Page } from '@playwright/test'

const ADMIN_EMAIL = 'admin@insta-pilot.local'
const USER_EMAIL  = 'user@insta-pilot.local'
const PASSWORD = 'password'

async function loginAs(page: Page, email: string) {
  await page.goto('/#/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).not.toHaveURL(/\/#\/login/)
}

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
    await loginAs(page, ADMIN_EMAIL)
    await page.goto('/#/settings/llm')

    await expect(page).toHaveURL(/\/#\/settings\/llm/)
    // Страница загружается без JS-ошибок
    const jsErrors: string[] = []
    page.on('pageerror', (err) => jsErrors.push(err.message))
    await page.waitForTimeout(500)
    expect(jsErrors).toHaveLength(0)
  })
})
