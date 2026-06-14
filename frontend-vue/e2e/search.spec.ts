import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '@/../e2e/helpers'

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
    const hashtagInput = page.locator('input[placeholder*="хэштег" i], input[placeholder*="hashtag" i]').first()
    await expect(hashtagInput).toBeVisible()
  })
})
