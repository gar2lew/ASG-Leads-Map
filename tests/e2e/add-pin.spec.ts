import { test, expect } from '@playwright/test';
import {
  waitForMapReady,
  clickAddPin,
  clickMapLocation,
  waitForModal,
  selectOutcome,
  fillAddress,
  confirmAddress,
  pressEscape,
  mockGeocodeSuccess,
  mockGeocodeFailure,
  takeScreenshot,
  collectConsoleErrors,
  expectNoConsoleErrors,
  clickCancelModal,
  mockMapTiles,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
});

test.describe('Add Pin - Placement Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForMapReady(page);
  });

  test('should enter placement mode when Add Pin is clicked', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await clickAddPin(page);

    // Placement mode indicator should be visible
    await expect(page.getByText(/tap a property on the map to place the new pin/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /click map to place/i })).toBeVisible();

    expectNoConsoleErrors(errors);
  });

  test('should cancel placement mode with Escape key', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await clickAddPin(page);
    await pressEscape(page);

    // Should return to normal state
    await expect(page.getByText(/tap a property on the map to place the new pin/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /add pin/i })).toBeVisible();

    expectNoConsoleErrors(errors);
  });

  test('should open modal when clicking map in placement mode', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await mockGeocodeSuccess(page);
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);

    // Modal should have correct title
    await expect(page.getByRole('dialog', { name: /add property visit/i })).toBeVisible();

    expectNoConsoleErrors(errors);
  });

  test('repeat placement: cancel with Escape then place again', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    // First placement attempt - cancel with Escape
    await clickAddPin(page);
    await pressEscape(page);

    // Second placement attempt
    await clickAddPin(page);
    await mockGeocodeSuccess(page);
    await clickMapLocation(page);
    await waitForModal(page);

    await expect(page.getByRole('dialog', { name: /add property visit/i })).toBeVisible();

    expectNoConsoleErrors(errors);
  });

  test('repeat placement: place pin, cancel modal, then place again', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    // First placement - complete and cancel
    await clickAddPin(page);
    await mockGeocodeSuccess(page);
    await clickMapLocation(page);
    await waitForModal(page);
    await clickCancelModal(page);

    // Second placement
    await clickAddPin(page);
    await mockGeocodeSuccess(page);
    await clickMapLocation(page);
    await waitForModal(page);

    await expect(page.getByRole('dialog', { name: /add property visit/i })).toBeVisible();

    expectNoConsoleErrors(errors);
  });
});

test.describe('Add Property Visit Modal - Visual Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForMapReady(page);
    await clickAddPin(page);
    await mockGeocodeSuccess(page);
    await clickMapLocation(page);
    await waitForModal(page);
  });

  test('should display all required form sections', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    // Outcome section
    await expect(page.getByText(/outcome \*/i)).toBeVisible();
    const outcomes = ['Knocked', 'Not Knocked', 'Not Interested', 'Did Not Qualify', 'Lead'];
    for (const outcome of outcomes) {
      // Outcome cards are visible labels with the outcome text
      await expect(page.locator('.outcome-option', { hasText: new RegExp(`^${outcome}$`, 'i') })).toBeVisible();
    }

    // Property Address
    await expect(page.getByLabel(/^property address \*/i)).toBeVisible();

    // Address detection status
    await expect(page.getByText(/automatically detected from pin location/i)).toBeVisible();

    // Address confirmation - checkbox label
    await expect(page.getByLabel(/confirm.*correct property address|address confirmed/i)).toBeVisible();

    // Notes
    await expect(page.getByLabel(/^notes$/i)).toBeVisible();

    // Contact fields only appear for Lead - hidden on the default Not Knocked outcome
    await expect(page.getByText(/lead details/i)).not.toBeVisible();
    await expect(page.getByLabel(/^name \*/i)).not.toBeVisible();
    await expect(page.getByLabel(/^mobile/i)).not.toBeVisible();
    await expect(page.getByLabel(/^email$/i)).not.toBeVisible();

    // Coordinates
    await expect(page.getByText(/location:/i)).toBeVisible();

    // Buttons
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /save pin/i })).toBeVisible();

    await takeScreenshot(page, 'add-property-visit');

    expectNoConsoleErrors(errors);
  });

  test('should show Lead Details and Save Lead when Lead is selected', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await selectOutcome(page, 'Lead');

    await expect(page.getByText(/lead details/i)).toBeVisible();
    await expect(page.getByLabel(/^name \*/i)).toBeVisible();
    await expect(page.getByLabel(/^mobile/i)).toBeVisible();
    await expect(page.getByLabel(/^email$/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /save lead/i })).toBeDisabled();

    expectNoConsoleErrors(errors);
  });

  test('should have all five outcome cards selectable', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    const outcomes = ['Knocked', 'Not Knocked', 'Not Interested', 'Did Not Qualify', 'Lead'];

    for (const outcome of outcomes) {
      await selectOutcome(page, outcome);
      // Verify the selected outcome card has selected state
      const radio = page.getByRole('radio', { name: new RegExp(`^${outcome}$`, 'i') });
      await expect(radio).toBeChecked();
    }

    expectNoConsoleErrors(errors);
  });
});

test.describe('Reverse Geocoding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForMapReady(page);
  });

  test('should populate address when geocoding succeeds', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await mockGeocodeSuccess(page);
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);

    // Wait for geocoding to complete and address to populate
    await expect(page.getByLabel(/^property address \*/i)).toHaveValue('42 Smith Street, Joondalup, WA, 6027', { timeout: 10000 });

    // Address detection indicator should show
    await expect(page.getByText(/automatically detected from pin location/i)).toBeVisible();

    // Address should be editable
    const addressInput = page.getByLabel(/^property address \*/i);
    await expect(addressInput).toBeEditable();

    await takeScreenshot(page, 'add-property-visit-address-populated');

    expectNoConsoleErrors(errors);
  });

  test('should allow manual address entry when geocoding fails', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await mockGeocodeFailure(page);
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);

    // Error message should appear
    await expect(page.getByText(/address could not be detected automatically/i)).toBeVisible();

    // Address field should be empty and editable
    const addressInput = page.getByLabel(/^property address \*/i);
    await expect(addressInput).toHaveValue('');
    await expect(addressInput).toBeEditable();

    // Should be able to enter manual address
    await fillAddress(page, 'Manual Address, Suburb WA 6000');
    await expect(addressInput).toHaveValue('Manual Address, Suburb WA 6000');

    // Should be able to confirm and save
    await confirmAddress(page);
    await selectOutcome(page, 'Knocked');

    // Save button should be enabled - no contact details needed for non-Lead
    await expect(page.getByRole('button', { name: /save pin/i })).toBeEnabled();

    expectNoConsoleErrors(errors);
  });
});

test.describe('Address Confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForMapReady(page);
    await clickAddPin(page);
    await mockGeocodeSuccess(page);
    await clickMapLocation(page);
    await waitForModal(page);
    // Wait for address to populate
    await expect(page.getByLabel(/^property address \*/i)).toHaveValue('42 Smith Street, Joondalup, WA, 6027', { timeout: 10000 });
  });

  test('should start with confirmation unchecked and save disabled', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    const checkbox = page.getByLabel(/^i confirm this is the correct property address$/i);
    await expect(checkbox).not.toBeChecked();

    // Save button should be disabled
    await expect(page.getByRole('button', { name: /save pin/i })).toBeDisabled();

    expectNoConsoleErrors(errors);
  });

  test('should enable save when address is confirmed', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await selectOutcome(page, 'Knocked');
    await confirmAddress(page);

    await expect(page.getByRole('button', { name: /save pin/i })).toBeEnabled();

    expectNoConsoleErrors(errors);
  });

  test('should reset confirmation when address is edited', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    // Confirm address
    await confirmAddress(page);
    const checkbox = page.getByRole('checkbox', { name: /confirm.*correct property address|address confirmed/i });
    await expect(checkbox).toBeChecked();

    // Save enabled without any contact details for non-Lead
    await expect(page.getByRole('button', { name: /save pin/i })).toBeEnabled();

    // Edit address
    await fillAddress(page, '42A Smith Street, Joondalup, WA, 6027');

    // Confirmation should be reset
    await expect(checkbox).not.toBeChecked();

    // Save should be disabled again
    await expect(page.getByRole('button', { name: /save pin/i })).toBeDisabled();

    // Re-confirm edited address
    await confirmAddress(page);
    await expect(checkbox).toBeChecked();
    await expect(page.getByRole('button', { name: /save pin/i })).toBeEnabled();

    expectNoConsoleErrors(errors);
  });
});
