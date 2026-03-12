import { test, expect, type Page } from '@playwright/test'

const ADMIN_EMAIL = 'admin@insta-pilot.local'
const USER_EMAIL = 'user@insta-pilot.local'
const PASSWORD = 'password'

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/#/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await expect(page).not.toHaveURL(/\/#\/login/)
}

test.describe('Admin Users — E2E', () => {
  test('admin видит список пользователей', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, PASSWORD)

    await page.goto('/#/admin/users')

    await expect(page).toHaveURL(/\/#\/admin\/users/)
    // Ждём загрузки таблицы — QTable рендерит .q-table__container
    await expect(page.locator('.q-table__container')).toBeVisible()
  })

  test('не-admin не может зайти на /admin/users → редирект на /', async ({ page }) => {
    await loginAs(page, USER_EMAIL, PASSWORD)

    await page.goto('/#/admin/users')

    await expect(page).toHaveURL(/\/#\/$/)
  })
})
