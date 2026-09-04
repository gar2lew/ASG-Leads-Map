import { test, expect } from '@playwright/test';
import {
  waitForMapReady,
  clickAddPin,
  clickMapLocation,
  waitForModal,
  selectOutcome,
  confirmAddress,
  fillContactDetails,
  fillAddress,
  clickSavePin,
  mockGeocodeSuccess,
  verifyPinSaved,
  selectOutcomeFilter,
  clearOutcomeFilter,
  reloadAndWait,
  collectConsoleErrors,
  expectNoConsoleErrors,
  takeScreenshot,
  mockMapTiles,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
});

test.describe('Outcome Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForMapReady(page);
  });

  const outcomes = [
    { key: 'knocked', label: 'Knocked' },
    { key: 'not_knocked', label: 'Not Knocked' },
    { key: 'not_interested', label: 'Not Interested' },
    { key: 'did_not_qualify', label: 'Did Not Qualify' },
    { key: 'lead', label: 'Lead', requiresContact: true },
  ];

  for (const outcome of outcomes) {
    test(`should save pin with ${outcome.label} outcome`, async ({ page }) => {
      const errors = collectConsoleErrors(page);

      await mockGeocodeSuccess(page);
      await clickAddPin(page);
      await clickMapLocation(page);
      await waitForModal(page);

      // Wait for address to populate
      await expect(page.getByLabel(/^property address \*/i)).toHaveValue('42 Smith Street, Joondalup, WA, 6027', { timeout: 10000 });

      // Select outcome
      await selectOutcome(page, outcome.label);

      // Confirm address
      await confirmAddress(page);

      // Fill contact details for Lead only - other outcomes require none
      if (outcome.requiresContact) {
        await fillContactDetails(page, {
          name: `Test ${outcome.label}`,
          phone: '0412 345 678',
          email: `test${outcome.key.toLowerCase().replace(' ', '')}@example.com`,
        });
      }

      // Save
      await clickSavePin(page);

      // Modal should close
      await expect(page.getByRole('dialog', { name: /add property visit/i })).not.toBeVisible({ timeout: 5000 });

      // Verify pin count updates
      await verifyPinSaved(page, outcome.key, 1);

      expectNoConsoleErrors(errors);
    });
  }
});

test.describe('Lead Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForMapReady(page);
  });

  test('should save Lead with full contact details', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await mockGeocodeSuccess(page);
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);

    await expect(page.getByLabel(/^property address \*/i)).toHaveValue('42 Smith Street, Joondalup, WA, 6027', { timeout: 10000 });

    await selectOutcome(page, 'Lead');

    // Fill required Lead contact details
    await fillContactDetails(page, {
      name: 'Test Lead Contact',
      phone: '0412 345 678',
      email: 'testlead@example.com',
    });

    await confirmAddress(page);

    await clickSavePin(page);

    await expect(page.getByRole('dialog', { name: /add property visit/i })).not.toBeVisible({ timeout: 5000 });

    await verifyPinSaved(page, 'lead', 1);

    expectNoConsoleErrors(errors);
  });

  test('should block Lead save without contact name or valid mobile', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await mockGeocodeSuccess(page);
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);

    await expect(page.getByLabel(/^property address \*/i)).toHaveValue('42 Smith Street, Joondalup, WA, 6027', { timeout: 10000 });

    await selectOutcome(page, 'Lead');
    await confirmAddress(page);

    // Try to save without contact details - should be disabled
    await expect(page.getByRole('button', { name: /save lead/i })).toBeDisabled();

    // Name only - still disabled (mobile missing)
    await page.getByLabel(/^name \*/i).fill('Test Lead');
    await expect(page.getByRole('button', { name: /save lead/i })).toBeDisabled();

    // Invalid mobile - still disabled
    await page.getByLabel(/^mobile/i).fill('02 1234 5678');
    await expect(page.getByRole('button', { name: /save lead/i })).toBeDisabled();

    // Valid Australian mobile - save enabled
    await page.getByLabel(/^mobile/i).fill('0412 345 678');
    await expect(page.getByRole('button', { name: /save lead/i })).toBeEnabled();

    expectNoConsoleErrors(errors);
  });
});

test.describe('Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForMapReady(page);
    await clickAddPin(page);
    await mockGeocodeSuccess(page);
    await clickMapLocation(page);
    await waitForModal(page);
    await expect(page.getByLabel(/^property address \*/i)).toHaveValue('42 Smith Street, Joondalup, WA, 6027', { timeout: 10000 });
  });

  test('should block save when required fields are missing', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    // Without any required fields filled, save should be disabled
    await expect(page.getByRole('button', { name: /save pin/i })).toBeDisabled();

    // Fill only address - save still disabled (no confirmation)
    await fillAddress(page, 'Test Address');
    await expect(page.getByRole('button', { name: /save pin/i })).toBeDisabled();

    // Confirm address - save enabled for non-Lead (no contact details required)
    await confirmAddress(page);
    await expect(page.getByRole('button', { name: /save pin/i })).toBeEnabled();

    expectNoConsoleErrors(errors);
  });

  test('should block save without address confirmation', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await selectOutcome(page, 'Knocked');

    await expect(page.getByRole('button', { name: /save pin/i })).toBeDisabled();

    expectNoConsoleErrors(errors);
  });

  test('should block save with empty address', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    // Default state: address is empty, save should be disabled
    await expect(page.getByRole('button', { name: /save pin/i })).toBeDisabled();

    // Fill other fields but leave address empty
    await selectOutcome(page, 'Knocked');
    // Checkbox is disabled when address is empty, so we can't confirm

    // Save should still be disabled
    await expect(page.getByRole('button', { name: /save pin/i })).toBeDisabled();

    expectNoConsoleErrors(errors);
  });
});

test.describe('Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForMapReady(page);
  });

  test('should filter pins by outcome chip', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    // Create a Knocked pin
    await mockGeocodeSuccess(page);
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);
    await expect(page.getByLabel(/^property address \*/i)).toHaveValue('42 Smith Street, Joondalup, WA, 6027', { timeout: 10000 });
    await selectOutcome(page, 'Knocked');
    await confirmAddress(page);
    await clickSavePin(page);
    // Wait for modal to close
    await expect(page.getByRole('dialog', { name: /add property visit/i })).not.toBeVisible({ timeout: 5000 });
    await verifyPinSaved(page, 'knocked', 1);

// Create a Not Knocked pin
    // Ensure modal is fully closed
    await expect(page.getByRole('dialog', { name: /add property visit/i })).not.toBeAttached({ timeout: 10000 });
    await page.waitForTimeout(2000);
    await mockGeocodeSuccess(page);
    // Click Add Pin button explicitly
    const addPinButton = page.getByRole('button', { name: /add pin/i });
    await expect(addPinButton).toBeVisible({ timeout: 5000 });
    await addPinButton.click();
    // Wait for placement mode to be active and map listener to attach
    await expect(page.getByText(/tap a property on the map to place the new pin/i)).toBeVisible({ timeout: 10000 });
    // Additional wait for map listener to attach
    await page.waitForTimeout(3000);
    await clickMapLocation(page);
    await waitForModal(page);
    await expect(page.getByLabel(/^property address \*/i)).toHaveValue('42 Smith Street, Joondalup, WA, 6027', { timeout: 10000 });
    await selectOutcome(page, 'Not Knocked');
    await confirmAddress(page);
    await clickSavePin(page);
    // Wait for modal to close
    await expect(page.getByRole('dialog', { name: /add property visit/i })).not.toBeVisible({ timeout: 5000 });
    await verifyPinSaved(page, 'not-knocked', 1);

    // Filter by Knocked - should show only 1 pin on map
    await selectOutcomeFilter(page, 'Knocked');
    await verifyPinSaved(page, 'knocked', 1);
    // Outcome chips show total counts, not filtered counts
    // Not Knocked chip should still show total count (1)
    await verifyPinSaved(page, 'not-knocked', 1);

    // Clear filter
    await clearOutcomeFilter(page, 'Knocked');
    await verifyPinSaved(page, 'knocked', 1);
    await verifyPinSaved(page, 'not-knocked', 1);

    expectNoConsoleErrors(errors);
  });

  test('search input should be functional', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    const searchInput = page.getByPlaceholder(/search address or suburb/i);
    await expect(searchInput).toBeVisible();

    // Type in search - just verify it accepts input
    await searchInput.fill('Joondalup');
    await expect(searchInput).toHaveValue('Joondalup');

    await searchInput.clear();
    await expect(searchInput).toHaveValue('');

    expectNoConsoleErrors(errors);
  });
});

test.describe('Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForMapReady(page);
  });

  test('should persist pins after page reload', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    // Create a pin
    await mockGeocodeSuccess(page);
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);
    await expect(page.getByLabel(/^property address \*/i)).toHaveValue('42 Smith Street, Joondalup, WA, 6027', { timeout: 10000 });
    await selectOutcome(page, 'Knocked');
    await confirmAddress(page);
    await clickSavePin(page);
    await verifyPinSaved(page, 'knocked', 1);

    // Reload page
    await reloadAndWait(page);

    // Pin should still exist
    await verifyPinSaved(page, 'knocked', 1);

    // Map should show the pin (visually verify by checking outcome count)
    await expect(page.locator('.toolbar__count')).toHaveText(/showing 1 of 1 pins/i);

    expectNoConsoleErrors(errors);
  });
});

test.describe('Immediate Pin Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForMapReady(page);
  });

  test('should show pin immediately after save without refresh', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await mockGeocodeSuccess(page);
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);
    await expect(page.getByLabel(/^property address \*/i)).toHaveValue('42 Smith Street, Joondalup, WA, 6027', { timeout: 10000 });
    await selectOutcome(page, 'Lead');
    await confirmAddress(page);
    await fillContactDetails(page, {
      name: 'Immediate Render Test',
      phone: '0412 345 678',
      email: 'immediate@example.com',
    });
    await clickSavePin(page);

    // Modal closes
    await expect(page.getByRole('dialog', { name: /add property visit/i })).not.toBeVisible({ timeout: 5000 });

    // Pin count should update immediately
    await verifyPinSaved(page, 'lead', 1);

    // Pin should be visible on map (map markers are canvas-based, verify via count)
    await expect(page.locator('.toolbar__count')).toHaveText(/showing 1 of 1 pins/i);

    expectNoConsoleErrors(errors);
  });
});

test.describe('CSV Export', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'CSV export is a desktop management action.');
    await page.goto('/');
    await waitForMapReady(page);
  });

  test('should download CSV file when Export CSV is clicked', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    // Create a pin first
    await mockGeocodeSuccess(page);
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);
    await expect(page.getByLabel(/^property address \*/i)).toHaveValue('42 Smith Street, Joondalup, WA, 6027', { timeout: 10000 });
    await selectOutcome(page, 'Knocked');
    await confirmAddress(page);
    await clickSavePin(page);
    await verifyPinSaved(page, 'knocked', 1);

    // Click Export CSV and wait for download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export csv/i }).click();
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/pins.*\.csv$/i);

    // Read the file content
    const buffer = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of buffer) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString('utf-8');

    // Verify CSV has expected headers
    expect(content).toContain('id');
    expect(content).toContain('latitude');
    expect(content).toContain('longitude');
    expect(content).toContain('outcome');
    expect(content).toContain('address');

    // Verify our test pin data is in the CSV
    expect(content).toContain('knocked');
    expect(content).toContain('42 Smith Street, Joondalup, WA, 6027');

    await takeScreenshot(page, 'csv-export');

    expectNoConsoleErrors(errors);
  });

  test('Export CSV should be disabled when no pins', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    // Fresh page with no pins - Export should be disabled
    await expect(page.getByRole('button', { name: /export csv/i })).toBeDisabled();

    expectNoConsoleErrors(errors);
  });
});
