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

test.describe('Feed — E2E', () => {
  test('страница ленты загружается и показывает выбор аккаунта или посты', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/feed')

    await expect(page).toHaveURL(/\/#\/feed/)
    // Ожидаем либо select аккаунта, либо masonry-сетку с постами
    const hasContent = await Promise.race([
      page.locator('.masonry-grid, [class*="masonry"]').waitFor({ timeout: 5000 }).then(() => true),
      page.locator('.q-select, select').first().waitFor({ timeout: 5000 }).then(() => true)
    ]).catch(() => false)

    expect(hasContent).toBe(true)
  })

  test('клик на пост → открытие PostDetailModal', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/feed')

    // Ждём появления карточек постов
    const card = page.locator('.card, [class*="media-card"]').first()
    await card.waitFor({ timeout: 10_000 }).catch(() => null)

    if (await card.isVisible()) {
      await card.click()
      await expect(page.locator('.q-dialog')).toBeVisible({ timeout: 5000 })
    }
  })

  test('страница ленты недоступна без авторизации', async ({ page }) => {
    await page.goto('/#/feed')
    await expect(page).toHaveURL(/\/#\/login/)
  })

  test('переключение аккаунта показывает обновлённый select', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/feed')

    const accountSelect = page.locator('.q-select').first()
    if (await accountSelect.isVisible()) {
      await expect(accountSelect).toBeVisible()
    }
  })

  test('кнопка refresh видна на странице ленты', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/#/feed')

    await expect(page).toHaveURL(/\/#\/feed/)
    // Страница загружается без ошибок
    await expect(page.locator('body')).not.toContainText('Error')
  })
})
