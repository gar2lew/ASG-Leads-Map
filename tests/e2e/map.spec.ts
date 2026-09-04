import { test, expect } from '@playwright/test';
import {
  waitForMapReady,
  collectConsoleErrors,
  expectNoConsoleErrors,
  takeScreenshot,
  mockMapTiles,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
});

test.describe('Map Page - Core Navigation & Visual Structure', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop structure is covered by the dedicated mobile layout test.');
    await page.goto('/');
    await waitForMapReady(page);
  });

  test('should load application and show map page by default', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await expect(page.getByRole('heading', { name: /field map/i })).toBeVisible();
    await expect(page.locator('.map-page__map')).toBeVisible();

    await takeScreenshot(page, 'map-desktop');

    expectNoConsoleErrors(errors);
  });

  test('should have correct header structure with title and actions', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    // Page title
    await expect(page.getByRole('heading', { name: /field map/i })).toBeVisible();
    await expect(page.getByText(/track visits, outcomes and leads across your territory/i)).toBeVisible();

    // Primary action - Add Pin
    await expect(page.getByRole('button', { name: /add pin/i })).toBeVisible();

    // Secondary action - Sync
    await expect(page.getByRole('button', { name: /sync/i })).toBeVisible();

    // Tertiary action - Export CSV
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();

    expectNoConsoleErrors(errors);
  });

  test('should show filter bar with search, outcome chips, and rep filter', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    // Search input
    await expect(page.getByPlaceholder(/search address or suburb/i)).toBeVisible();

    // Outcome filter chips
    const outcomes = ['Knocked', 'Not Knocked', 'Not Interested', 'Did Not Qualify', 'Lead'];
    for (const outcome of outcomes) {
      await expect(page.getByRole('button', { name: new RegExp(`filter by ${outcome}`, 'i') })).toBeVisible();
    }

    // Rep filter dropdown
    await expect(page.getByLabel(/rep/i)).toBeVisible();

    // Pin count
    await expect(page.getByText(/showing \d+ of \d+ pins/i)).toBeVisible();

    expectNoConsoleErrors(errors);
  });

  test('should have outcome chips with counts and colored dots', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    const chips = page.locator('.outcome-chip');
    await expect(chips).toHaveCount(5);

    // Each chip should have a colored dot
    for (const outcome of ['Knocked', 'Not Knocked', 'Not Interested', 'Did Not Qualify', 'Lead']) {
      const chip = page.getByRole('button', { name: new RegExp(`filter by ${outcome}`, 'i') });
      await expect(chip.locator('.outcome-chip__dot')).toBeVisible();
      await expect(chip.locator('.outcome-chip__count')).toBeVisible();
    }

    expectNoConsoleErrors(errors);
  });

  test('navigation tabs work correctly', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    // Map should be active by default
    await expect(page.getByRole('heading', { name: /field map/i })).toBeVisible();

    // Navigate to Dashboard
    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Navigate to Settings
    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();

    // Navigate back to Map
    await page.getByRole('link', { name: 'Map', exact: true }).click();
    await expect(page.getByRole('heading', { name: /field map/i })).toBeVisible();

    expectNoConsoleErrors(errors);
  });
});

test.describe('Map Page - Responsive Layout', () => {
  test('should adapt to tablet viewport (1024px)', async ({ page, isMobile }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/');
    await waitForMapReady(page);

    const errors = collectConsoleErrors(page);

    if (isMobile) {
      await expect(page.getByRole('navigation', { name: /field navigation/i })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: /field map/i })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /add pin/i })).toBeVisible();
    await expect(page.locator('.map-page__map')).toBeVisible();
    await expect(page.getByPlaceholder(/search address or suburb/i)).toBeVisible();

    await takeScreenshot(page, 'map-tablet');

    expectNoConsoleErrors(errors);
  });

  test('should adapt to mobile viewport (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await waitForMapReady(page);

    const errors = collectConsoleErrors(page);

    await expect(page.getByRole('button', { name: /add pin/i })).toBeVisible();
    await expect(page.locator('.map-page__map')).toBeVisible();
    await expect(page.getByRole('toolbar', { name: /map filters/i })).toBeVisible();
    await expect(page.getByRole('navigation', { name: /field navigation/i })).toBeVisible();

    await takeScreenshot(page, 'map-mobile');

    expectNoConsoleErrors(errors);
  });
});
