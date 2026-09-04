# Phase 1 Release Stabilisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilise the current Super Admin release-polish working tree into a deterministic, warning-free release candidate without adding Phase 2 features.

**Architecture:** Preserve the existing React, IndexedDB, Firebase Auth, and Vercel-function boundaries. Correct drift at its source—the canonical development fixture and shared browser helpers—then make tile degradation non-blocking, remove superseded popup code, and clean narrowly proven static-quality issues.

**Tech Stack:** React 19, TypeScript 6, Vite 8, MapLibre GL 6, Vitest 4, Testing Library, Playwright, Firebase 12, Oxlint.

**Spec:** `docs/superpowers/specs/2026-09-04-phase-1-release-stabilisation-design.md`

## Global Constraints

- Preserve all existing user changes in the dirty working tree.
- Do not begin Firestore pin sync, live reporting, territory assignment, or Jotform work.
- Use TDD for every behavioural production change.
- Keep the canonical development Super Admin at `admin@asg.local` / `admin123`.
- Do not add dependencies.
- Do not hide real runtime errors merely to satisfy tests.
- Keep all map actions usable when external raster tiles fail.
- Preserve mobile safe areas, 44px touch targets, permissions, and existing routes.

---

### Task 1: Canonical development identity and browser contract

**Files:**
- Modify: `src/auth/currentUser.ts`
- Modify: `README.md`
- Modify: `tests/e2e/auth.spec.ts`
- Modify: `tests/e2e/roles.spec.ts`
- Modify: `tests/e2e/admin-users.spec.ts`
- Modify: `tests/e2e/map.spec.ts`

**Interfaces:**
- Consumes: `DEV_USERS: Record<Role, CurrentUser>` and the existing `loginAs` E2E helper.
- Produces: one canonical Super Admin fixture with email `admin@asg.local`, display name `Admin User`, and role `super_admin`; browser assertions matching current accessible names and responsive visibility.

- [ ] **Step 1: Run the smallest failing authentication test**

Run: `npx playwright test tests/e2e/auth.spec.ts -g "admin can log in" --project=chromium --workers=1`

Expected: FAIL because `admin@asg.local` does not match the current hard-coded Super Admin email.

- [ ] **Step 2: Correct the canonical development fixture**

Change the `Role.SuperAdmin` entry in `src/auth/currentUser.ts` to:

```ts
{
  id: 'dev-super-admin',
  uid: 'dev-super-admin',
  name: 'Admin User',
  displayName: 'Admin User',
  email: 'admin@asg.local',
  role: Role.SuperAdmin,
  active: true,
}
```

Retain `admin123` in `src/auth/services/devStore.ts`. Ensure README and visible dev-harness guidance use the same credentials.

- [ ] **Step 3: Verify authentication and admin E2E tests**

Run: `npx playwright test tests/e2e/auth.spec.ts tests/e2e/admin-users.spec.ts --project=chromium --workers=1`

Expected: authentication succeeds; any remaining failures are limited to stale selectors or UI workflows rather than credentials.

- [ ] **Step 4: Align accessible-name and responsive assertions**

Use `Primary navigation`, the current Super Admin label, and mobile-visible controls. Replace the mobile heading assertion with assertions for the visible Add Pin action, map application, filter toolbar, and field navigation.

- [ ] **Step 5: Verify the affected browser files**

Run: `npx playwright test tests/e2e/auth.spec.ts tests/e2e/admin-users.spec.ts tests/e2e/roles.spec.ts tests/e2e/map.spec.ts --project=chromium --workers=1`

Expected: PASS.

- [ ] **Step 6: Commit the coherent fixture update**

```powershell
git add -- src/auth/currentUser.ts README.md tests/e2e/auth.spec.ts tests/e2e/admin-users.spec.ts tests/e2e/roles.spec.ts tests/e2e/map.spec.ts
git commit -m "fix: align super admin development fixtures"
```

### Task 2: Deterministic non-blocking tile failure handling

**Files:**
- Modify: `src/pages/MapPage.tsx`
- Modify: `src/pages/MapPage.css`
- Modify: `src/pages/MapPage.test.tsx`
- Modify: `tests/e2e/helpers.ts`
- Modify: `tests/e2e/workflows.spec.ts` only if it needs the shared helper explicitly.

**Interfaces:**
- Consumes: MapLibre's `error` event and Playwright `Page.route`.
- Produces: `mapTileErrorMessage(error: unknown): string` or equivalent focused logic; `mockMapTiles(page: Page): Promise<void>` used by shared E2E setup.

- [ ] **Step 1: Add a failing component regression test**

Add a MapPage test that emits a MapLibre error event and asserts the tile notice is rendered without a full-screen blocking class and that filter controls remain enabled. The production change that makes this test fail is reverting to the current blocking overlay.

- [ ] **Step 2: Run the regression test and verify RED**

Run: `npm test -- src/pages/MapPage.test.tsx -t "keeps map controls usable when tiles fail"`

Expected: FAIL because the current `.map-page__tile-error` overlay covers the map workspace and intercepts clicks.

- [ ] **Step 3: Implement the minimal non-blocking notice**

Keep the existing Retry action, but size and position the notice as a compact overlay. Log only a stable message derived from the error, for example:

```ts
const message = error instanceof Error ? error.message : 'Map tile request failed'
console.warn('Map tile unavailable:', message)
```

Never pass the complete MapLibre event object to `console.warn`.

- [ ] **Step 4: Verify GREEN and the complete MapPage test file**

Run: `npm test -- src/pages/MapPage.test.tsx`

Expected: PASS with no unhandled errors.

- [ ] **Step 5: Add deterministic tile interception to the E2E helper**

Implement a shared helper in `tests/e2e/helpers.ts`:

```ts
export async function mockMapTiles(page: Page): Promise<void> {
  await page.route('**/ArcGIS/rest/services/World_Imagery/MapServer/tile/**', async (route) => {
    await route.fulfill({ status: 204 })
  })
}
```

Call it from the common map setup before navigation so ordinary workflows do not depend on Esri availability. Keep one explicit failure scenario using a controlled failed response.

- [ ] **Step 6: Verify the previously blocked filter workflow**

Run: `npx playwright test tests/e2e/workflows.spec.ts -g "filter pins by outcome" --project=chromium --workers=1`

Expected: PASS without external tile warnings or pointer interception.

- [ ] **Step 7: Commit tile reliability changes**

```powershell
git add -- src/pages/MapPage.tsx src/pages/MapPage.css src/pages/MapPage.test.tsx tests/e2e/helpers.ts tests/e2e/workflows.spec.ts
git commit -m "fix: keep map controls usable during tile failures"
```

### Task 3: Remove the superseded popup path

**Files:**
- Modify: `src/pages/MapPage.tsx`
- Modify: `src/pages/MapPage.css`
- Modify: `src/pages/MapPage.test.tsx`

**Interfaces:**
- Consumes: `SelectedPinSheet` callbacks already rendered from `selectedPin`.
- Produces: one property-details interaction path with no `maplibregl.Popup`, `renderPopupHTML`, DOM query, timeout, or manual popup event listeners.

- [ ] **Step 1: Strengthen the existing selected-pin test**

Assert that marker selection renders the React `Property details` complementary region and that `document.querySelector('.maplibregl-popup')` remains null after Update, Edit, Delete, and close actions are exposed.

- [ ] **Step 2: Run the selected-pin test before cleanup**

Run: `npm test -- src/pages/MapPage.test.tsx -t "touch-friendly actions|property details"`

Expected: PASS, establishing preserved behaviour before refactoring.

- [ ] **Step 3: Remove only the dead popup implementation**

Delete `popupRef`, `showPopup`, `attachPopupListeners`, `renderPopupHTML`, the `void showPopup` marker, popup cleanup calls, and unused popup CSS. Keep `handlePinClick`, map `easeTo`, and all `SelectedPinSheet` callbacks unchanged.

- [ ] **Step 4: Verify preserved behaviour**

Run: `npm test -- src/pages/MapPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the focused refactor**

```powershell
git add -- src/pages/MapPage.tsx src/pages/MapPage.css src/pages/MapPage.test.tsx
git commit -m "refactor: remove legacy map popup path"
```

### Task 4: Resolve React warnings and ineffective lazy imports

**Files:**
- Modify: `src/components/PinModal.tsx`
- Modify: `src/components/PinModal.test.tsx`
- Modify: `src/pages/MapPage.tsx`
- Modify: `src/pages/MapPage.test.tsx`
- Modify: `src/domain/index.ts`
- Modify: `src/domain/csv.ts`

**Interfaces:**
- Consumes: current PinModal initialisation and MapPage pin-loading/marker-rendering behaviour.
- Produces: stable callback/effect ordering with complete dependency arrays; CSV remains loaded only by the export action.

- [ ] **Step 1: Record the current static warnings**

Run: `npm run lint`

Expected: four warnings: one synchronous state update in `PinModal`, two MapPage declaration-order warnings, and one missing `renderPins` dependency.

- [ ] **Step 2: Preserve PinModal reset behaviour with a focused test**

Add or identify a test that closes and reopens the modal for a different pin and asserts all form fields reflect the new input. Run it before refactoring to establish existing behaviour.

- [ ] **Step 3: Refactor effect-driven initialisation without behaviour changes**

Move synchronous initial values to state initialisers or reset them from the event that changes the editing record. If a keyed child boundary is the smallest safe option, key the modal sheet by pin id/new-pin coordinates so React performs a clean remount.

- [ ] **Step 4: Stabilise MapPage callbacks**

Declare `loadPins` and `renderPins` before effects that consume them and wrap them in `useCallback` with complete dependencies. Ensure marker cleanup still occurs and filters update marker rendering.

- [ ] **Step 5: Restore useful CSV lazy loading**

Remove `export * from './csv'` from `src/domain/index.ts` because `MapPage` imports CSV directly only inside `handleExportCsv`. Preserve direct imports in CSV tests. Do not remove `pinStorage` from the barrel unless all static consumers can be changed safely within this task.

- [ ] **Step 6: Verify focused behaviour and static checks**

Run: `npm test -- src/components/PinModal.test.tsx src/pages/MapPage.test.tsx src/domain/csv.test.ts`

Expected: PASS.

Run: `npm run lint`

Expected: exit 0 with no warnings.

Run: `npm run build`

Expected: exit 0; the ineffective `csv.ts` dynamic-import warning is absent.

- [ ] **Step 7: Commit static-quality fixes**

```powershell
git add -- src/components/PinModal.tsx src/components/PinModal.test.tsx src/pages/MapPage.tsx src/pages/MapPage.test.tsx src/domain/index.ts src/domain/csv.ts
git commit -m "fix: resolve release quality warnings"
```

### Task 5: Repository hygiene and full release verification

**Files:**
- Modify: `.gitignore`
- Modify: `README.md` only if verification counts or commands are stale.
- Modify only regression files proven necessary by the full checks.

**Interfaces:**
- Consumes: outputs from Vitest, Playwright, Vite, Oxlint, and Git.
- Produces: a clean verification result and ignored generated artifacts.

- [ ] **Step 1: Add focused generated-artifact exclusions**

Keep the existing environment exclusions and remove duplicate `.vercel` entries. Add:

```gitignore
playwright-report/
test-results/
.superpowers/
compaction context/
leads-map-w-pins.json
```

Do not ignore application source, Firebase rules, API handlers, scripts, or E2E specifications.

- [ ] **Step 2: Check repository whitespace**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Run the full unit suite**

Run: `npm test`

Expected: all Vitest files and tests pass.

- [ ] **Step 4: Run lint and production build**

Run: `npm run lint`

Expected: exit 0 with no warnings.

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 5: Run the complete Chromium browser suite**

Run: `npx playwright test --project=chromium --workers=1`

Expected: all 64 tests pass without external tile dependency or excessive console output.

- [ ] **Step 6: Inspect the final working tree**

Run: `git status --short`

Expected: generated reports and local session archives are absent; only intentional application/config/test changes remain.

- [ ] **Step 7: Commit repository hygiene if commits are authorised**

```powershell
git add -- .gitignore README.md
git commit -m "chore: clean release verification artifacts"
```

