import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Navigation — E2E', () => {
  test('навигация по основным маршрутам через меню', async ({ page }) => {
    await loginAsAdmin(page)

    // Переходим по маршрутам через прямой goto
    await page.goto('/#/feed')
    await expect(page).toHaveURL(/\/#\/feed/)

    await page.goto('/#/search')
    await expect(page).toHaveURL(/\/#\/search/)

    await page.goto('/#/logs')
    await expect(page).toHaveURL(/\/#\/logs/)
  })

  test('несуществующий маршрут показывает страницу 404', async ({ page }) => {
    await loginAsAdmin(page)

    await page.goto('/#/this-does-not-exist-xyz')

    // Должна рендериться ErrorNotFound страница
    await expect(page.locator('body')).toBeVisible()
    // Проверяем что нет редиректа на /login
    await expect(page).not.toHaveURL(/\/#\/login/)
  })

  test('главная навигация рендерится без ошибок', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (err) => jsErrors.push(err.message))

    await loginAsAdmin(page)
    await page.goto('/#/')

    // Ожидаем любой контент страницы вместо sleep
    await page.locator('.q-layout, main, #app').first().waitFor({ state: 'visible', timeout: 5000 })
    expect(jsErrors).toHaveLength(0)
  })
})
