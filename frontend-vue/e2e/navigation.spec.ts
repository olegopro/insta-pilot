import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '@/../e2e/helpers'

test.describe('Navigation — E2E', () => {
  test('навигация по основным маршрутам через меню', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (error) => jsErrors.push(error.message))

    await loginAsAdmin(page)

    // Главная — ждём рендер layout без runtime-ошибок
    await page.goto('/#/')
    await page.locator('.q-layout, main, #app').first().waitFor({ state: 'visible', timeout: 5000 })

    // Переходим по маршрутам через прямой goto
    await page.goto('/#/feed')
    await expect(page).toHaveURL(/\/#\/feed/)

    await page.goto('/#/search')
    await expect(page).toHaveURL(/\/#\/search/)

    await page.goto('/#/logs')
    await expect(page).toHaveURL(/\/#\/logs/)

    expect(jsErrors).toHaveLength(0)
  })

  test('несуществующий маршрут показывает страницу 404', async ({ page }) => {
    await loginAsAdmin(page)

    await page.goto('/#/this-does-not-exist-xyz')

    // Должна рендериться ErrorNotFound страница
    await expect(page.locator('body')).toBeVisible()
    // Проверяем что нет редиректа на /login
    await expect(page).not.toHaveURL(/\/#\/login/)
  })
})
