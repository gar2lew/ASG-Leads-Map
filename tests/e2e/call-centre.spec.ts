import { test, expect } from '@playwright/test'

test.describe('Call centre workspace', () => {
  test('shows premium capture and register controls on desktop and mobile', async ({ page }) => {
    await page.goto('/calls')
    await expect(page.getByRole('heading', { name: 'Call centre' })).toBeVisible()
    await expect(page.getByRole('button', { name: /log door knock/i })).toBeVisible()
    await expect(page.getByLabel('Sent to Timely CRM')).toBeVisible()
    await expect(page.getByRole('heading', { name: /lead register/i })).toBeVisible()
  })
})
