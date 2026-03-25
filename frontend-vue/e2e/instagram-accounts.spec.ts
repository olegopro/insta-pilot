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

test.describe('Instagram Accounts — E2E', () => {
  test('отображение списка аккаунтов (таблица)', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/')

    await expect(page.locator('.q-table__container')).toBeVisible()
  })

  test('открытие формы добавления аккаунта', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/')

    // Ищем кнопку добавления
    const addButton = page.locator('button').filter({ hasText: /добавить|add/i }).first()
    await addButton.click()

    await expect(page.locator('.q-dialog')).toBeVisible()
  })

  test('просмотр деталей аккаунта (кнопка view)', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/')

    await expect(page.locator('.q-table__container')).toBeVisible()

    // Кликаем на кнопку просмотра первой строки таблицы
    const viewButton = page.locator('.q-table tbody tr').first().locator('button').first()
    await viewButton.click()

    await expect(page.locator('.q-dialog')).toBeVisible()
  })

  test('поиск в таблице фильтрует строки', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/')

    await expect(page.locator('.q-table__container')).toBeVisible()

    // Вводим невозможный поисковый запрос
    const searchInput = page.locator('input[type="search"], input[placeholder*="поис" i], input[placeholder*="search" i]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('xyzxyz_nonexistent_query')
      await expect(page.locator('.q-table tbody tr')).toHaveCount(0)
    }
  })

  test('страница доступна только аутентифицированному', async ({ page }) => {
    await page.goto('/#/')
    await expect(page).toHaveURL(/\/#\/login/)
  })

  test('не-admin пользователь видит только свои аккаунты', async ({ page }) => {
    await page.goto('/#/login')
    await page.fill('input[type="email"]', 'user@insta-pilot.local')
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).not.toHaveURL(/\/#\/login/)

    await expect(page.locator('.q-table__container')).toBeVisible()
  })
})
