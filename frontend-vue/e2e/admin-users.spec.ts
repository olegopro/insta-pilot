import { test, expect } from '@playwright/test'
import { loginAs, ADMIN_EMAIL, USER_EMAIL } from './helpers'

test.describe('Admin Users — E2E', () => {
  test('admin видит список пользователей', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL)

    await page.goto('/#/admin/users')

    await expect(page).toHaveURL(/\/#\/admin\/users/)
    // Ждём загрузки таблицы — QTable рендерит .q-table__container
    await expect(page.locator('.q-table__container')).toBeVisible()
  })

  test('не-admin не может зайти на /admin/users → редирект на /', async ({ page }) => {
    await loginAs(page, USER_EMAIL)

    await page.goto('/#/admin/users')

    await expect(page).toHaveURL(/\/#\/$/)
  })
})
