import { expect, type Page } from '@playwright/test'

export const ADMIN_EMAIL = 'admin@insta-pilot.local'
export const USER_EMAIL  = 'user@insta-pilot.local'
export const PASSWORD    = 'password'

export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto('/#/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).not.toHaveURL(/\/#\/login/)
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, ADMIN_EMAIL)
}
