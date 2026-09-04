import { test, expect } from '@playwright/test';
import {
  waitForMapReady,
  loginAs,
  ensureSignedOut,
  signOut,
  collectConsoleErrors,
  expectNoConsoleErrors,
  mockMapTiles,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
});

test.describe('Authentication (dev harness)', () => {
  test('admin can log in and is redirected to /map', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await loginAs(page, 'admin@asg.local', 'admin123');

    await waitForMapReady(page);
    await expect(page.locator('.header__user-name')).toHaveText('Admin User');

    expectNoConsoleErrors(errors);
  });

  test('manager can log in and is redirected to /map', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await loginAs(page, 'manager@asg.local', 'manager123');

    await waitForMapReady(page);
    await expect(page.locator('.header__user-name')).toHaveText('Manager User');

    expectNoConsoleErrors(errors);
  });

  test('rep can log in and is redirected to /map', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await loginAs(page, 'rep@asg.local', 'rep123');

    await waitForMapReady(page);
    await expect(page.locator('.header__user-name')).toHaveText('Rep User');

    expectNoConsoleErrors(errors);
  });

  test('disabled account is denied access', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await ensureSignedOut(page);
    await page.getByLabel(/email/i).fill('disabled@asg.local');
    await page.getByLabel(/password/i).fill('disabled123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should stay on login page with error
    await expect(page).toHaveURL('/login');
    await expect(page.getByText(/account has been disabled/i)).toBeVisible();

    expectNoConsoleErrors(errors);
  });

  test('invalid credentials show error', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await ensureSignedOut(page);
    await page.getByLabel(/email/i).fill('admin@asg.local');
    await page.getByLabel(/password/i).fill('wrong');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL('/login');
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();

    expectNoConsoleErrors(errors);
  });

  test('sign out redirects to /login and clears session', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await loginAs(page, 'admin@asg.local', 'admin123');
    await waitForMapReady(page);

    await signOut(page);

    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // Verify session cleared - navigating to protected route redirects to login
    await page.goto('/map');
    await expect(page).toHaveURL('/login');

    expectNoConsoleErrors(errors);
  });

  test('session persists across page reload', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await loginAs(page, 'manager@asg.local', 'manager123');
    await waitForMapReady(page);

    await page.reload({ waitUntil: 'networkidle' });
    await waitForMapReady(page);

    await expect(page.locator('.header__user-name')).toHaveText('Manager User');
    await expect(page).toHaveURL('/map');

    expectNoConsoleErrors(errors);
  });

  test('protected route redirects to login with return destination', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    // Ensure signed-out state persists across page load
    await page.addInitScript(() => {
      window.localStorage.setItem('asg-dev-signed-out', 'true')
    })

    // Try to access /dashboard without login
    await page.goto('/dashboard');

    // Should redirect to /login with state.from
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('form')).toBeVisible();

    // Login and verify redirect back to dashboard
    await loginAs(page, 'admin@asg.local', 'admin123', '/dashboard');

    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    expectNoConsoleErrors(errors);
  });
});
