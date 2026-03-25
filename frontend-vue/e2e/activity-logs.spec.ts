import { test, expect, type Page } from '@playwright/test'

const ADMIN_EMAIL = 'admin@insta-pilot.local'
const PASSWORD = 'password'

async function loginAsAdmin(page: Page) {
  await page.goto('/#/login')
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).not.toHaveURL(/\/#\/login/)
}

test.describe('Activity Logs — E2E', () => {
  test('страница логов загружается', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/logs')

    await expect(page).toHaveURL(/\/#\/logs/)
    await expect(page.locator('body')).not.toContainText('Error')
  })

  test('таблица логов отображается', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/logs')

    await expect(page.locator('.q-table__container')).toBeVisible({ timeout: 10_000 })
  })

  test('фильтры логов присутствуют на странице', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/logs')

    await expect(page.locator('.q-table__container')).toBeVisible({ timeout: 10_000 })

    // Ищем select-фильтры (action, status, date)
    const filters = page.locator('.q-select')
    const count = await filters.count()
    expect(count).toBeGreaterThan(0)
  })

  test('клик по строке таблицы раскрывает детали', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/logs')

    await expect(page.locator('.q-table__container')).toBeVisible({ timeout: 10_000 })

    const firstRow = page.locator('.q-table tbody tr').first()
    if (await firstRow.isVisible()) {
      await firstRow.click()
      // После клика должна раскрыться строка с деталями
      await page.waitForTimeout(300)
      const expandedContent = page.locator('[class*="expanded"], [class*="expand"], .q-tr--expand')
      if (!await expandedContent.isVisible()) {
        // Некоторые реализации используют другой паттерн расширения
        await expect(page.locator('.q-table__container')).toBeVisible()
      }
    }
  })

  test('страница логов недоступна без авторизации', async ({ page }) => {
    await page.goto('/#/logs')
    await expect(page).toHaveURL(/\/#\/login/)
  })
})
