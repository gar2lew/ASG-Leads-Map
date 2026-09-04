import { test, expect } from '@playwright/test';
import {
  waitForMapReady,
  loginAs,
  collectConsoleErrors,
  expectNoConsoleErrors,
  mockMapTiles,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
});

test.describe('Admin User Management (dev harness)', () => {
  test('admin sees Admin Users navigation link', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await loginAs(page, 'admin@asg.local', 'admin123');
    await waitForMapReady(page);

    await expect(page.getByRole('navigation', { name: /primary navigation|field navigation/i })).toContainText('Admin Users');

    expectNoConsoleErrors(errors);
  });

  test('rep is redirected away from Admin Users page', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await loginAs(page, 'rep@asg.local', 'rep123');
    await waitForMapReady(page);

    await page.goto('/admin/users');

    // Should be redirected to map (RequireRole redirects without error message)
    await expect(page).toHaveURL('/map');

    expectNoConsoleErrors(errors);
  });

  test('manager is redirected away from Admin Users page', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await loginAs(page, 'manager@asg.local', 'manager123');
    await waitForMapReady(page);

    await page.goto('/admin/users');

    await expect(page).toHaveURL('/map');

    expectNoConsoleErrors(errors);
  });

  test('admin can create a user and sees temporary password', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await loginAs(page, 'admin@asg.local', 'admin123');
    await waitForMapReady(page);

    await page.goto('/admin/users');

    // Click Add user
    await page.getByRole('button', { name: /add user/i }).click();

    // Fill form - use exact label for role select in create form
    await page.getByLabel(/email\*/i).fill('newrep@asg.local');
    await page.getByLabel(/display name\*/i).fill('New Rep');
    await page.getByLabel(/^role$/i).selectOption('rep');
    await page.getByRole('button', { name: /create user/i }).click();

    // Verify success - temporary password displayed
    await expect(page.getByText(/share this one-time password/i)).toBeVisible();
    const tempPassword = await page.getByText(/asg-dev123/i).textContent();
    expect(tempPassword).toContain('asg-dev123');

    // New user appears in table
    await expect(page.getByRole('row', { name: /New Rep/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /newrep@asg.local/ })).toBeVisible();

    expectNoConsoleErrors(errors);
  });

  test('admin can deactivate a user', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await loginAs(page, 'admin@asg.local', 'admin123');
    await waitForMapReady(page);

    await page.goto('/admin/users');

    // Find the rep row (pre-seeded as "Rep User")
    const repRow = page.getByRole('row', { name: /Rep User/ });
    await expect(repRow).toBeVisible();

    await repRow.getByRole('button', { name: /edit user/i }).click();
    const editor = page.getByRole('dialog', { name: /edit user/i });
    await editor.getByLabel(/status/i).selectOption('disabled');
    await editor.getByRole('button', { name: /save changes/i }).click();

    // Status changes to Disabled
    await expect(page.getByRole('row', { name: /Rep User.*Disabled/ })).toBeVisible();

    expectNoConsoleErrors(errors);
  });

  test('admin can change a user role', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await loginAs(page, 'admin@asg.local', 'admin123');
    await waitForMapReady(page);

    await page.goto('/admin/users');

    const repRow = page.getByRole('row', { name: /Rep User/ });
    await expect(repRow).toBeVisible();

    await repRow.getByRole('button', { name: /edit user/i }).click();
    const editor = page.getByRole('dialog', { name: /edit user/i });
    await editor.getByLabel(/role/i).selectOption('manager');
    await editor.getByRole('button', { name: /save changes/i }).click();

    await expect(page.getByRole('row', { name: /Rep User.*Manager/ })).toBeVisible();

    expectNoConsoleErrors(errors);
  });

  test('admin cannot deactivate or change own role', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await loginAs(page, 'admin@asg.local', 'admin123');
    await waitForMapReady(page);

    await page.goto('/admin/users');

    const ownRow = page.getByRole('row', { name: /Admin User/ });

    await ownRow.getByRole('button', { name: /edit user/i }).click();
    const editor = page.getByRole('dialog', { name: /edit user/i });
    await expect(editor.getByLabel(/role/i)).toBeDisabled();
    await expect(editor.getByLabel(/status/i)).toBeDisabled();

    expectNoConsoleErrors(errors);
  });
});
