import { test, expect } from '@playwright/test';
import {
  waitForMapReady,
  clickAddPin,
  clickMapLocation,
  waitForModal,
  selectOutcome,
  fillAddress,
  fillHouseNumber,
  clickEditFullAddress,
  confirmAddress,
  mockGeocodeReverse,
  mockOverpass,
  clickSavePin,
  takeScreenshot,
  collectConsoleErrors,
  expectNoConsoleErrors,
  mockMapTiles,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await mockMapTiles(page);
});

const ADDRESS_INPUT = /^property address \*/i;

test.describe('Property Address Resolution', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForMapReady(page);
  });

  test('A. direct house number from Nominatim populates the property address', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    let overpassRequests = 0;
    page.on('request', (req) => {
      if (req.url().includes('overpass-api')) overpassRequests++;
    });

    await mockGeocodeReverse(page, { house_number: '17', road: 'Melba Place', suburb: 'Westminster', state: 'WA', postcode: '6061' });
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);

    await expect(page.getByLabel(ADDRESS_INPUT)).toHaveValue('17 Melba Place, Westminster, WA, 6061', { timeout: 10000 });
    await expect(page.getByText(/automatically detected from pin location/i)).toBeVisible();
    expect(overpassRequests).toBe(0);

    await takeScreenshot(page, 'property-address-direct');

    expectNoConsoleErrors(errors);
  });

  test('B. nearby OSM fallback chooses the nearest property on the road', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await mockGeocodeReverse(page, { road: 'Melba Place', suburb: 'Westminster', state: 'WA', postcode: '6061' });
    await mockOverpass(page, [
      { houseNumber: '19', street: 'Melba Place', distanceMetres: 21 },
      { houseNumber: '17', street: 'Melba Place', distanceMetres: 6 },
    ]);
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);

    await expect(page.getByLabel(ADDRESS_INPUT)).toHaveValue('17 Melba Place, Westminster, WA, 6061', { timeout: 10000 });
    await expect(page.getByText(/automatically detected from pin location/i)).toBeVisible();

    await takeScreenshot(page, 'property-address-fallback');

    expectNoConsoleErrors(errors);
  });

  test('C. ambiguous result with no usable nearby property keeps manual entry', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await mockGeocodeReverse(page, { road: 'Melba Place', suburb: 'Westminster', state: 'WA', postcode: '6061' });
    await mockOverpass(page, [{ houseNumber: '50', street: 'Melba Place', distanceMetres: 30 }]);
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);

    await expect(page.getByText(/house number could not be identified/i)).toBeVisible({ timeout: 10000 });

    await clickEditFullAddress(page);
    await expect(page.getByLabel(ADDRESS_INPUT)).toHaveValue('Melba Place, Westminster, WA, 6061');

    await fillAddress(page, '17A Melba Place, Westminster, WA, 6061');
    await confirmAddress(page);
    await selectOutcome(page, 'Knocked');
    await expect(page.getByRole('button', { name: /save pin/i })).toBeEnabled();

    expectNoConsoleErrors(errors);
  });

  test('D. same-street candidate is preferred over a marginally closer different street', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await mockGeocodeReverse(page, { road: 'Melba Place', suburb: 'Westminster', state: 'WA', postcode: '6061' });
    await mockOverpass(page, [
      { houseNumber: '24', street: 'Arkana Road', distanceMetres: 8 },
      { houseNumber: '17', street: 'Melba Place', distanceMetres: 12 },
    ]);
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);

    await expect(page.getByLabel(ADDRESS_INPUT)).toHaveValue('17 Melba Place, Westminster, WA, 6061', { timeout: 10000 });
    await expect(page.getByText(/suggested nearby property/i)).toBeVisible();

    await takeScreenshot(page, 'property-address-street-match');

    expectNoConsoleErrors(errors);
  });

  test('E. nearby lookup failure falls back to manual address flow', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await mockGeocodeReverse(page, { road: 'Melba Place', suburb: 'Westminster', state: 'WA', postcode: '6061' });
    await mockOverpass(page, [], true);
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);

    await expect(page.getByText(/house number could not be identified/i)).toBeVisible({ timeout: 10000 });

    await clickEditFullAddress(page);
    await expect(page.getByLabel(ADDRESS_INPUT)).toHaveValue('Melba Place, Westminster, WA, 6061');

    await fillAddress(page, '5 Arkana Road, Westminster, WA, 6061');
    await confirmAddress(page);
    await selectOutcome(page, 'Knocked');
    await clickSavePin(page);

    expectNoConsoleErrors(errors);
  });

  test('F. house-number fallback composes the full address from the number only', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await mockGeocodeReverse(page, { road: 'Melba Place', suburb: 'Westminster', state: 'WA', postcode: '6061' });
    await mockOverpass(page, []);
    await clickAddPin(page);
    await clickMapLocation(page);
    await waitForModal(page);

    await expect(page.getByLabel(/^house number$/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/house number could not be identified/i)).toBeVisible();
    await expect(page.getByLabel(ADDRESS_INPUT)).not.toBeVisible();

    await fillHouseNumber(page, '17-19');
    await expect(page.getByText(/composed address: 17-19 melba place, westminster, wa, 6061/i)).toBeVisible();

    await confirmAddress(page);
    await selectOutcome(page, 'Knocked');
    await clickSavePin(page);

    expectNoConsoleErrors(errors);
  });
});
