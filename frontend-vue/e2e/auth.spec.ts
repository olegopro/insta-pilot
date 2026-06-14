import { test, expect, type Page } from '@playwright/test'

const ADMIN_EMAIL = 'admin@insta-pilot.local'
const ADMIN_PASSWORD = 'password'

const PROTECTED_ROUTES = [
  '/#/feed',
  '/#/search',
  '/#/',
  '/#/logs',
  '/#/admin/users'
]

async function fillLoginForm(page: Page, email: string, password: string) {
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
}

test.describe('Auth — E2E', () => {
  test('успешный логин → редирект на /', async ({ page }) => {
    await page.goto('/#/login')

    await fillLoginForm(page, ADMIN_EMAIL, ADMIN_PASSWORD)

    await expect(page).toHaveURL(/\/#\/$/)
  })

  test('неверный пароль → ошибка на странице', async ({ page }) => {
    await page.goto('/#/login')

    await fillLoginForm(page, ADMIN_EMAIL, 'wrongpassword')

    // Quasar Notify появляется в DOM как .q-notification
    await expect(page.locator('.q-notification')).toBeVisible()
  })

  for (const route of PROTECTED_ROUTES) {
    test(`${route} недоступна без авторизации → /login`, async ({ page }) => {
      // У каждого теста свой браузерный контекст → localStorage пуст
      await page.goto(route)

      await expect(page).toHaveURL(/\/#\/login/)
    })
  }
})
