import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '@/../e2e/helpers'

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

    // Ждём появления карточки поста, кликаем и проверяем открытие модалки
    const card = page.locator('.card, [class*="media-card"]').first()
    await card.waitFor({ timeout: 10_000 })
    await card.click()
    await expect(page.locator('.q-dialog')).toBeVisible({ timeout: 5000 })
  })
})
