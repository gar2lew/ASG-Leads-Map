import { test, expect } from '@playwright/test';
import {
  waitForMapReady,
  setRole,
  collectConsoleErrors,
  expectNoConsoleErrors,
  mockMapTiles,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
});

test.describe('Role-based access control (dev roles)', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop header controls are covered separately from mobile route guards.');
    await page.goto('/');
    await waitForMapReady(page);
  });

  test('admin sees Dashboard and Settings navigation and Export CSV', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await expect(page.getByRole('navigation', { name: /primary navigation/i })).toContainText('Dashboard');
    await expect(page.getByRole('navigation', { name: /primary navigation/i })).toContainText('Settings');
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add pin/i })).toBeVisible();
    await expect(page.locator('.header__user-name')).toHaveText('Admin User');

    expectNoConsoleErrors(errors);
  });

  test('manager sees Dashboard but not Settings, can export and create pins', async ({ page }) => {
    await setRole(page, 'manager');
    await page.goto('/');
    await waitForMapReady(page);
    const errors = collectConsoleErrors(page);

    await expect(page.getByRole('navigation', { name: /primary navigation/i })).toContainText('Dashboard');
    await expect(page.getByRole('navigation', { name: /primary navigation/i })).not.toContainText('Settings');
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add pin/i })).toBeVisible();
    await expect(page.locator('.header__user-name')).toHaveText('Manager User');

    expectNoConsoleErrors(errors);
  });

  test('rep sees only Map, cannot export, can still create pins', async ({ page }) => {
    await setRole(page, 'rep');
    await page.goto('/');
    await waitForMapReady(page);
    const errors = collectConsoleErrors(page);

    await expect(page.getByRole('navigation', { name: /primary navigation/i })).not.toContainText('Dashboard');
    await expect(page.getByRole('navigation', { name: /primary navigation/i })).not.toContainText('Settings');
    await expect(page.getByRole('button', { name: /export csv/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /add pin/i })).toBeVisible();
    await expect(page.locator('.header__user-name')).toHaveText('Rep User');

    expectNoConsoleErrors(errors);
  });
});

test.describe('Role-based route guards', () => {
  test('rep is blocked from the Dashboard', async ({ page }) => {
    await setRole(page, 'rep');
    await page.goto('/dashboard');

    await expect(page.getByText(/you do not have permission to view reports/i)).toBeVisible();
  });

  test('rep is blocked from Settings', async ({ page }) => {
    await setRole(page, 'rep');
    await page.goto('/settings');

    await expect(page.getByText(/you do not have permission to manage settings/i)).toBeVisible();
  });

  test('manager is blocked from Settings', async ({ page }) => {
    await setRole(page, 'manager');
    await page.goto('/settings');

    await expect(page.getByText(/you do not have permission to manage settings/i)).toBeVisible();
  });

  test('admin can open Dashboard and Settings directly', async ({ page }) => {
    await setRole(page, 'super_admin');
    await page.goto('/dashboard');

    await expect(page.getByText(/you do not have permission/i)).not.toBeVisible();
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    await page.goto('/settings');

    await expect(page.getByText(/you do not have permission/i)).not.toBeVisible();
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });
});
