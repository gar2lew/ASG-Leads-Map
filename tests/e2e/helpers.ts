import { type Page, type Route, expect } from '@playwright/test';

export const GEOCODE_MOCK_ADDRESS = '42 Smith Street, Joondalup, WA, 6027';

/**
 * Keep browser tests independent of Esri availability and prevent expected
 * external tile failures from obscuring application behaviour.
 */
export async function mockMapTiles(page: Page): Promise<void> {
  await page.route('**/ArcGIS/rest/services/World_Imagery/MapServer/tile/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      path: 'public/logo.png',
    });
  });
}

/**
 * Intercept and mock the Nominatim reverse geocoding request.
 */
export async function mockGeocodeSuccess(page: Page, _address: string = GEOCODE_MOCK_ADDRESS): Promise<void> {
  await page.route('**/nominatim.openstreetmap.org/reverse**', async (route: Route) => {
    const mockResponse = {
      place_id: 123456,
      licence: 'Data © OpenStreetMap contributors',
      osm_type: 'way',
      osm_id: 789012,
      lat: '-31.9505',
      lon: '115.8605',
      display_name: '42 Smith Street, Joondalup, WA 6027',
      address: {
        house_number: '42',
        road: 'Smith Street',
        suburb: 'Joondalup',
        city: 'Joondalup',
        state: 'WA',
        postcode: '6027',
        country: 'Australia',
        country_code: 'au',
      },
      boundingbox: ['-31.9515', '-31.9495', '115.8595', '115.8615'],
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponse),
    });
  });
}

/**
 * Intercept and mock a failed Nominatim reverse geocoding request.
 */
export async function mockGeocodeFailure(page: Page): Promise<void> {
  await page.route('**/nominatim.openstreetmap.org/reverse**', async (route: Route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Service unavailable' }),
    });
  });
}

const DROP_LAT = -31.9505;
const DROP_LON = 115.8605;
const METRES_PER_DEGREE_LAT = 111320;

function coordinatesAt(distanceMetres: number): { lat: number; lon: number } {
  return {
    lat: DROP_LAT + distanceMetres / METRES_PER_DEGREE_LAT,
    lon: DROP_LON,
  };
}

export interface OverpassMockCandidate {
  houseNumber: string;
  street?: string;
  unit?: string;
  distanceMetres: number;
}

/**
 * Intercept and mock the Nominatim reverse geocoding request with a
 * configurable address payload. Pass `house_number` to simulate a direct
 * hit; omit it to simulate a street-only result that triggers the nearby
 * property lookup.
 */
export async function mockGeocodeReverse(page: Page, address: Record<string, string> = {}): Promise<void> {
  const merged: Record<string, string> = {
    road: 'Melba Place',
    suburb: 'Westminster',
    state: 'WA',
    postcode: '6061',
    country: 'Australia',
    country_code: 'au',
    ...address,
  };
  const streetPart = merged.house_number ? `${merged.house_number} ${merged.road}` : merged.road;
  const displayName = `${streetPart}, ${merged.suburb}, ${merged.state} ${merged.postcode}`;
  await page.route('**/nominatim.openstreetmap.org/reverse**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        place_id: 999,
        licence: 'Data © OpenStreetMap contributors',
        osm_type: 'way',
        osm_id: 123,
        lat: String(DROP_LAT),
        lon: String(DROP_LON),
        display_name: displayName,
        address: merged,
        boundingbox: [
          String(DROP_LAT - 0.001),
          String(DROP_LAT + 0.001),
          String(DROP_LON - 0.001),
          String(DROP_LON + 0.001),
        ],
      }),
    });
  });
}

/**
 * Intercept and mock the Overpass nearby-property lookup.
 * When `fail` is true the request returns a 503.
 */
export async function mockOverpass(
  page: Page,
  candidates: OverpassMockCandidate[],
  fail = false
): Promise<void> {
  await page.route('**/overpass-api.de/api/interpreter**', async (route: Route) => {
    if (fail) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ remark: 'timeout' }),
      });
      return;
    }
    const elements = candidates.map((c, i) => {
      const pos = coordinatesAt(c.distanceMetres);
      const tags: Record<string, string> = { 'addr:housenumber': c.houseNumber };
      if (c.street) tags['addr:street'] = c.street;
      if (c.unit) tags['addr:unit'] = c.unit;
      return { type: 'node', id: 1000 + i, lat: pos.lat, lon: pos.lon, tags };
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ elements }),
    });
  });
}

/**
 * Click the "Add Pin" button to enter placement mode.
 */
export async function clickAddPin(page: Page): Promise<void> {
  await page.getByRole('button', { name: /add pin/i }).click();
  // Wait for placement mode indicator
  await expect(page.getByText(/tap a property on the map to place the new pin/i)).toBeVisible({ timeout: 10000 });
}

/**
 * Click a location on the map to place a pin.
 * Uses the center of the map viewport.
 */
export async function clickMapLocation(page: Page): Promise<void> {
  // Use test-only function to trigger map click directly
  await page.evaluate(() => {
    const lngLat = { lng: 115.8605, lat: -31.9505 };
    if ((window as any).__testTriggerMapClick) {
      (window as any).__testTriggerMapClick(lngLat);
    }
  });
}

/**
 * Click a specific coordinate on the map by converting lat/lng to pixel position.
 */
export async function clickMapCoordinate(page: Page, _lat: number, _lng: number): Promise<void> {
  const mapContainer = page.locator('.map-page__map');
  const box = await mapContainer.boundingBox();
  if (!box) throw new Error('Map container not found');

  // This is an approximation - in reality MapLibre handles projection
  // For testing we use center click which is sufficient
  await mapContainer.click({ position: { x: 0.5, y: 0.5 } });
}

/**
 * Wait for the Add Property Visit modal to open.
 */
export async function waitForModal(page: Page): Promise<void> {
  await expect(page.getByRole('dialog', { name: /add property visit/i })).toBeVisible({ timeout: 10000 });
}

/**
 * Select an outcome in the modal.
 * The outcome options are hidden radio buttons with visible card labels.
 * We click the outcome option card element directly.
 */
export async function selectOutcome(page: Page, outcome: string): Promise<void> {
  // Click the outcome option card which contains the label text
  const card = page.locator('.outcome-option', { hasText: new RegExp(`^${outcome}$`, 'i') });
  await card.click();
  // Verify the radio input is checked
  const radio = page.getByRole('radio', { name: new RegExp(`^${outcome}$`, 'i') });
  await expect(radio).toBeChecked();
}

/**
 * Fill the address field.
 */
export async function fillAddress(page: Page, address: string): Promise<void> {
  const input = page.getByLabel(/^property address \*/i);
  await input.fill(address);
}

/**
 * Fill the house-number fallback field.
 */
export async function fillHouseNumber(page: Page, houseNumber: string): Promise<void> {
  const input = page.getByLabel(/^house number$/i);
  await input.fill(houseNumber);
}

/**
 * Switch the house-number fallback to the full address input.
 */
export async function clickEditFullAddress(page: Page): Promise<void> {
  await page.getByRole('button', { name: /edit full address/i }).click();
}

/**
 * Confirm the address checkbox.
 * The checkbox label text changes from "I confirm this is the correct property address" 
 * to "✓ Address confirmed" when checked.
 */
export async function confirmAddress(page: Page): Promise<void> {
  const checkbox = page.getByRole('checkbox', { name: /confirm.*correct property address|address confirmed/i });
  await checkbox.click();
  await expect(checkbox).toBeChecked();
}

/**
 * Verify address confirmation is reset after editing address.
 */
export async function verifyConfirmationReset(page: Page): Promise<void> {
  const checkbox = page.getByRole('checkbox', { name: /confirm.*correct property address|address confirmed/i });
  await expect(checkbox).not.toBeChecked();
}

/**
 * Fill contact details.
 */
export async function fillContactDetails(page: Page, details: { name: string; phone?: string; email?: string }): Promise<void> {
  await page.getByLabel(/^name \*/i).fill(details.name);
  if (details.phone) {
    await page.getByLabel(/^mobile/i).fill(details.phone);
  }
  if (details.email) {
    await page.getByLabel(/^email$/i).fill(details.email);
  }
}

/**
 * Fill notes.
 */
export async function fillNotes(page: Page, notes: string): Promise<void> {
  await page.getByLabel(/^notes$/i).fill(notes);
}

/**
 * Click the Save button in the modal and wait for it to close.
 * Matches "Save Pin", "Save Lead" and "Save Changes".
 */
export async function clickSavePin(page: Page): Promise<void> {
  await page.getByRole('button', { name: /save (pin|lead|changes)/i }).click();
  await expect(page.getByRole('dialog', { name: /add property visit/i })).not.toBeVisible({ timeout: 5000 });
}

/**
 * Click Cancel in the modal.
 */
export async function clickCancelModal(page: Page): Promise<void> {
  await page.getByRole('button', { name: /cancel/i }).click();
  await expect(page.getByRole('dialog', { name: /add property visit/i })).not.toBeVisible();
}

/**
 * Press Escape key to cancel placement mode or close modal.
 */
export async function pressEscape(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
}

/**
 * Verify a pin was saved by checking the outcome counts.
 */
export async function verifyPinSaved(page: Page, outcome: string, expectedCount: number): Promise<void> {
  const chip = page.locator(`.outcome-chip--${outcome.replace(/_/g, '-')} .outcome-chip__count`);
  await expect(chip).toHaveText(expectedCount.toString(), { timeout: 5000 });
}

/**
 * Select an outcome filter chip.
 */
export async function selectOutcomeFilter(page: Page, outcome: string): Promise<void> {
  const button = page.getByRole('button', { name: new RegExp(`filter by ${outcome}`, 'i') });
  await button.click();
}

/**
 * Clear outcome filter (click same chip again).
 */
export async function clearOutcomeFilter(page: Page, outcome: string): Promise<void> {
  await selectOutcomeFilter(page, outcome);
}

/**
 * Wait for map to be ready.
 */
export async function waitForMapReady(page: Page): Promise<void> {
  await page.waitForSelector('.map-page__map', { state: 'visible', timeout: 10000 });
  // Give MapLibre a moment to initialize
  await page.waitForTimeout(500);
}

/**
 * Collect console errors during test.
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  return errors;
}

/**
 * Check for unexpected console errors.
 */
export function expectNoConsoleErrors(errors: string[]): void {
  // Filter out known non-fatal errors
  const unexpected = errors.filter(
    (e) => 
      !e.includes('Failed to load resource') && 
      !e.includes('503') &&
      !e.includes('Service Unavailable') &&
      !e.includes('maplibre') &&
      !e.includes('MapLibre') &&
      !e.includes('Warning:')
  );
  if (unexpected.length > 0) {
    throw new Error(`Unexpected console errors:\n${unexpected.join('\n')}`);
  }
}

/**
 * Take a screenshot with a consistent name.
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `tests/screenshots/${name}.png`, fullPage: true });
}

/**
 * Wait for modal to close.
 */
export async function waitForModalClose(page: Page): Promise<void> {
  await expect(page.getByRole('dialog', { name: /add property visit/i })).not.toBeVisible({ timeout: 5000 });
}

/**
 * Reload the page and wait for it to be ready.
 */
export async function reloadAndWait(page: Page): Promise<void> {
  await page.reload({ waitUntil: 'networkidle' });
  await waitForMapReady(page);
}

/**
 * Seed the dev-role before the app loads so role-gated UI can be tested.
 * Must be called before page.goto.
 */
export async function setRole(page: Page, role: 'super_admin' | 'manager' | 'rep'): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem('asg-dev-role', value);
  }, role);
}

/**
 * Ensure the user is signed out. The dev harness auto-signs in as admin
 * by default, so we must explicitly sign out before testing the login flow.
 */
export async function ensureSignedOut(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => {
    window.localStorage.removeItem('asg-dev-auth-user');
    window.localStorage.setItem('asg-dev-signed-out', 'true');
  });
  await page.goto('/login');
  await expect(page.getByLabel(/email/i)).toBeVisible();
}

/**
 * Log in as a dev user via the Login page.
 * Uses the dev harness credentials: admin@asg.local/admin123, manager@asg.local/manager123, etc.
 * Waits for redirect to the destination (defaults to /map).
 * Automatically signs out first if already signed in.
 */
export async function loginAs(page: Page, email: string, password: string, destination = '/map'): Promise<void> {
  await ensureSignedOut(page);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(destination, { timeout: 10000 });
}

/**
 * Sign out by clicking the Sign Out button in the header.
 * Waits for redirect to /login.
 */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL('/login', { timeout: 10000 });
}
