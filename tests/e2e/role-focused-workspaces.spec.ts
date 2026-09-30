import { test, expect } from '@playwright/test'
import { clickAddPin, clickMapLocation, confirmAddress, mockGeocodeSuccess, mockMapTiles, selectOutcome, waitForMapReady, waitForModal } from './helpers'

test.beforeEach(async ({ page }) => {
  await mockMapTiles(page)
})

test('switches between Field Workspace and Call Centre on desktop and mobile', async ({ page, isMobile }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/map')
    await expect(page.locator('.map-page__map')).toBeVisible()
    await waitForMapReady(page)

    const navigation = isMobile || width <= 900
      ? page.getByRole('navigation', { name: 'Workspace navigation' })
      : page.getByRole('navigation', { name: 'Workspaces' })
    await navigation.getByRole('link', { name: 'Call Centre' }).click()
    await expect(page).toHaveURL(/\/calls$/)
    await expect(page.getByRole('heading', { name: 'Call centre' })).toBeVisible()

    await navigation.getByRole('link', { name: 'Field Workspace' }).click()
    await expect(page).toHaveURL(/\/map$/)
    await expect(page.locator('.map-page__map')).toBeVisible()
  }
})

test('opens both authorized workspaces directly', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/calls')
  await expect(page.getByRole('heading', { name: 'Call centre' })).toBeVisible()

  await page.goto('/map')
  await expect(page.locator('.map-page__map')).toBeVisible()
})

test('captures a lead, appends a call, marks Timely manually, and opens map safely', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/calls')
  await page.getByRole('group', { name: 'Quick capture actions' }).getByRole('button', { name: /add lead/i }).click()

  await page.getByLabel('Lead name').fill('E2E Workspace Lead')
  await page.getByLabel('Property address').fill('42 Smith Street, Joondalup WA 6027')
  await page.getByLabel('Contact number').fill('0412 345 678')
  await page.getByLabel('Qualification').selectOption('qualified')
  await page.getByLabel('Field notes').fill('Captured from the Call Centre regression flow.')
  await page.getByRole('button', { name: /save lead/i }).click()

  const card = page.locator('.lead-card').filter({ hasText: 'E2E Workspace Lead' })
  await expect(card).toBeVisible()
  await expect(page.getByRole('heading', { name: 'E2E Workspace Lead', exact: true })).toBeVisible()
  await expect(page.getByText('Activity timeline')).toBeVisible()

  await page.locator('.call-lead-detail').getByRole('button', { name: 'Log call' }).click()
  await page.getByLabel('Outcome').selectOption('Connected')
  await page.getByLabel('Field notes').fill('Confirmed the contact details.')
  await page.getByRole('button', { name: /save activity/i }).click()
  await expect(page.locator('.call-lead-detail__activity-title strong')).toContainText('Call · Connected')
  await expect(page.locator('.call-lead-detail__timeline')).toContainText('Confirmed the contact details.')

  const timely = page.locator('.call-lead-detail').getByRole('checkbox', { name: 'Sent to Timely CRM' })
  await timely.check()
  await expect(timely).toBeChecked()
  await expect(card.getByText('Sent to Timely')).toBeVisible()

  const mapLink = card.getByRole('link', { name: 'View E2E Workspace Lead on map' })
  await expect(mapLink).toHaveAttribute('target', '_blank')
  await expect(mapLink).toHaveAttribute('rel', /noopener/)
  const mapPagePromise = context.waitForEvent('page')
  await mapLink.click()
  const mapPage = await mapPagePromise
  await expect(mapPage).toHaveURL(/\/map\?leadId=/)
  await expect(page).toHaveURL(/\/calls$/)
  await expect(mapPage.getByText('This lead does not have a mapped address yet.')).toBeVisible()
})

test('selects a locally saved property from a map leadId deep link', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/map')
  await waitForMapReady(page)
  await mockGeocodeSuccess(page)
  await clickAddPin(page)
  await clickMapLocation(page)
  await waitForModal(page)
  await expect(page.getByLabel(/^property address \*/i)).toHaveValue('42 Smith Street, Joondalup, WA, 6027')
  await selectOutcome(page, 'Knocked')
  await confirmAddress(page)
  await page.getByLabel(/^notes$/i).fill('Created within this isolated browser context.')
  await page.getByRole('button', { name: /save pin/i }).click()
  await expect(page.getByText('Pin saved')).toBeVisible()

  const pinId = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('asg-leads-map')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const pins = await new Promise<Array<{ id: string; address: string }>>((resolve, reject) => {
      const transaction = database.transaction('pins', 'readonly')
      const request = transaction.objectStore('pins').getAll()
      request.onsuccess = () => resolve(request.result as Array<{ id: string; address: string }>)
      request.onerror = () => reject(request.error)
    })
    database.close()
    return pins.find((pin) => pin.address === '42 Smith Street, Joondalup, WA, 6027')?.id ?? null
  })
  expect(pinId).toBeTruthy()

  const deepLink = await context.newPage()
  await mockMapTiles(deepLink)
  await deepLink.setViewportSize({ width: 390, height: 844 })
  await deepLink.goto(`/map?leadId=${encodeURIComponent(pinId!)}`)
  await waitForMapReady(deepLink)
  await expect(deepLink.getByRole('complementary', { name: 'Property details' })).toBeVisible()
  await expect(deepLink.getByRole('heading', { name: '42 Smith Street, Joondalup, WA, 6027' })).toBeVisible()
})

for (const width of [320, 375, 390, 1280]) {
  test(`keeps both workspaces within the viewport at ${width}px`, async ({ page, isMobile }) => {
    await page.setViewportSize({ width, height: 900 })

    await page.goto('/map')
    await expect(page.locator('.map-page__map')).toBeVisible()
    await expect(page.getByRole('button', { name: /add pin/i })).toBeVisible()
    await expect(page.getByPlaceholder(/search address or suburb/i)).toBeVisible()
    if (isMobile || width <= 900) {
      const mobileNavigation = page.getByRole('navigation', { name: 'Workspace navigation' })
      await expect(mobileNavigation.getByRole('link', { name: 'Field Workspace' })).toBeVisible()
      await expect(mobileNavigation.getByRole('link', { name: 'Call Centre' })).toBeVisible()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    await page.goto('/calls')
    await expect(page.getByRole('heading', { name: 'Call centre' })).toBeVisible()
    await expect(page.getByRole('button', { name: /add lead/i }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /lead register/i })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('theme toggle applies readable semantic colors without reload', async ({ page }) => {
  await page.goto('/map')
  await expect(page.getByRole('button', { name: 'Toggle theme' })).toBeVisible()
  await page.getByRole('button', { name: 'Toggle theme' }).click()

  const theme = await page.evaluate(() => ({
    name: document.documentElement.dataset.theme,
    text: document.documentElement.style.getPropertyValue('--asg-theme-text'),
    canvas: document.documentElement.style.getPropertyValue('--asg-theme-canvas'),
    secondary: document.documentElement.style.getPropertyValue('--asg-theme-text-secondary'),
  }))
  expect(theme.name).toBe('dark')
  expect(theme.text).toBe('#ffffff')
  expect(theme.canvas).toBe('#07111d')
  expect(theme.secondary).toBe('#e6edf5')
})
