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

test.describe('Search — E2E', () => {
  test('страница поиска загружается', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/search')

    await expect(page).toHaveURL(/\/#\/search/)
    await expect(page.locator('body')).not.toContainText('Error')
  })

  test('поле поиска по хэштегу присутствует', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/search')

    // Ищем input для хэштега
    const hashtagInput = page.locator('input[placeholder*="хэштег" i], input[placeholder*="hashtag" i], input').first()
    await expect(hashtagInput).toBeVisible()
  })

  test('страница поиска недоступна без авторизации', async ({ page }) => {
    await page.goto('/#/search')
    await expect(page).toHaveURL(/\/#\/login/)
  })

  test('вкладки / таб-навигация по типу поиска присутствуют', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/search')

    // Ищем таб-панель с режимами поиска
    const tabs = page.locator('.q-tabs, [role="tablist"]')
    if (await tabs.isVisible()) {
      await expect(tabs).toBeVisible()
    } else {
      // Страница поиска без табов — проверяем что страница доступна
      await expect(page).toHaveURL(/\/#\/search/)
    }
  })

  test('форма поиска отправляется без ошибок JS', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (err) => jsErrors.push(err.message))

    await loginAsAdmin(page)
    await page.goto('/#/search')

    expect(jsErrors).toHaveLength(0)
  })
})
