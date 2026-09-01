# Premium Interface System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a cohesive premium ASG interface across every route, including solid outcome-coloured markers and a structured selected-property panel/sheet.

**Architecture:** Extend the existing design tokens and layout shell, then apply shared surface, typography, control, and responsive patterns page by page. Replace hand-built MapLibre popup markup with the existing React selected-pin surface, extended into a desktop side panel and mobile bottom sheet; isolate marker markup in a pure helper so the solid marker contract can be regression tested.

**Tech Stack:** React 19, TypeScript, CSS, MapLibre GL, React Router, Vitest, Testing Library, Vite

**Spec:** `docs/superpowers/specs/2026-09-01-premium-interface-system-design.md`

## Global Constraints

- Preserve authentication, permissions, storage, synchronisation, CSV behaviour, lead integration, outcome rules, and routing.
- Preserve unrelated working-tree changes and avoid broad rewrites or file-wide formatting.
- Keep a 44px minimum touch target and visible keyboard focus treatment.
- Status colours remain semantic; gold is decorative and must not replace outcome meaning.
- Retain the map-first mobile layout and fixed bottom navigation.
- Use `dd/MM/yyyy` for any new UI date formatting.
- Honour `prefers-reduced-motion` for nonessential animation.
- Follow TDD for behavioural changes and run targeted tests before broader checks.

---

### Task 1: Shared premium tokens and application shell

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/Layout.tsx`
- Modify: `src/components/Layout.css`
- Test: `src/pages/MapPage.test.tsx`

**Interfaces:**
- Consumes: existing CSS custom properties and authenticated layout props.
- Produces: `--asg-font-display`, shared premium surface/shadow tokens, and stable `.layout-*` shell classes used by all authenticated pages.

- [ ] **Step 1: Add a failing shell accessibility test**

Add an assertion to the existing MapPage layout test:

```tsx
expect(screen.getByRole('banner')).toHaveClass('layout__header')
expect(screen.getByRole('navigation', { name: /primary/i })).toBeVisible()
```

- [ ] **Step 2: Run the targeted test and confirm the semantic class expectation fails**

Run: `npm test -- src/pages/MapPage.test.tsx`

Expected: FAIL because the header/navigation does not yet expose the agreed shell semantics or class.

- [ ] **Step 3: Implement the shared shell contract**

In `index.css`, add a display-font token and premium elevation tokens without deleting compatibility aliases:

```css
--asg-font-display: 'Cormorant Garamond', Georgia, serif;
--asg-color-canvas: #081522;
--asg-color-ivory: #fbf7ef;
--asg-color-ivory-strong: #fffdf8;
--asg-border-premium: rgba(176, 141, 70, 0.28);
--asg-shadow-premium: 0 24px 64px rgba(4, 12, 22, 0.22);
```

Update the Google Fonts import to include Cormorant Garamond weights 500, 600, and 700. In `Layout.tsx`, retain routing and role checks while adding `role="banner"`, `aria-label="Primary"`, and stable BEM classes. In `Layout.css`, implement the refined navy header, gold active indicator, compact role badge, centred content frame, and existing mobile bottom navigation.

- [ ] **Step 4: Run the targeted test**

Run: `npm test -- src/pages/MapPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the shell checkpoint**

```powershell
git add src/index.css src/components/Layout.tsx src/components/Layout.css src/pages/MapPage.test.tsx
git commit -m "feat: refine premium application shell"
```

### Task 2: Solid status marker renderer

**Files:**
- Create: `src/components/mapMarkerMarkup.ts`
- Create: `src/components/mapMarkerMarkup.test.ts`
- Modify: `src/pages/MapPage.tsx`
- Modify: `src/pages/MapPage.css`
- Modify: `src/components/MapMarker.tsx`
- Modify: `src/components/MapMarker.css`

**Interfaces:**
- Consumes: `PinOutcome` and `pinOutcomeColor(outcome)`.
- Produces: `createMapMarkerMarkup(outcome: PinOutcome): string`, a single `.map-pin` marker contract shared by MapLibre and the React marker.

- [ ] **Step 1: Write the failing marker contract test**

```ts
import { describe, expect, it } from 'vitest'
import { PinOutcome } from '../domain'
import { createMapMarkerMarkup } from './mapMarkerMarkup'

describe('createMapMarkerMarkup', () => {
  it('renders a solid outcome-coloured body without a default pulse', () => {
    const markup = createMapMarkerMarkup(PinOutcome.NotInterested)
    expect(markup).toContain('class="map-pin__body"')
    expect(markup).toContain('--marker-color:#EF4444')
    expect(markup).not.toContain('pulse')
  })
})
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run: `npm test -- src/components/mapMarkerMarkup.test.ts`

Expected: FAIL because `mapMarkerMarkup.ts` does not exist.

- [ ] **Step 3: Implement the pure renderer and consolidate CSS**

Implement:

```ts
export function createMapMarkerMarkup(outcome: PinOutcome): string {
  const color = pinOutcomeColor(outcome)
  return `<span class="map-pin__body" style="--marker-color:${color}"><span class="map-pin__core" aria-hidden="true"></span></span>`
}
```

Use the helper in `MapPage.tsx`. Replace the competing `.map-marker*` rules with one `.map-pin` family: 40px solid teardrop body, `background: var(--marker-color)`, 3px ivory border, centred ivory core, navy shadow, gold/ivory selected ring, and no normal pulse. Keep only a reduced-motion-safe provisional placement treatment. Update `MapMarker.tsx` to match the same DOM/class contract and reduce `MapMarker.css` to cluster-only rules plus any React wrapper rules that are not supplied by `MapPage.css`.

- [ ] **Step 4: Run marker and map tests**

Run: `npm test -- src/components/mapMarkerMarkup.test.ts src/pages/MapPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the marker fix**

```powershell
git add src/components/mapMarkerMarkup.ts src/components/mapMarkerMarkup.test.ts src/components/MapMarker.tsx src/components/MapMarker.css src/pages/MapPage.tsx src/pages/MapPage.css
git commit -m "fix: render solid outcome map pins"
```

### Task 3: Unified selected-property panel and sheet

**Files:**
- Modify: `src/components/SelectedPinSheet.tsx`
- Modify: `src/components/SelectedPinSheet.css`
- Modify: `src/pages/MapPage.tsx`
- Modify: `src/pages/MapPage.test.tsx`

**Interfaces:**
- Consumes: selected `Pin`, close handler, update-outcome handler, edit handler, delete handler.
- Produces: `SelectedPinSheet` rendered as `.property-details` with desktop `aside` presentation and mobile dialog-like bottom sheet presentation.

- [ ] **Step 1: Write failing selection hierarchy tests**

Extend the selected-marker test:

```tsx
expect(await screen.findByRole('complementary', { name: /property details/i })).toBeVisible()
expect(screen.getByRole('heading', { name: /18 oceanview road/i })).toBeVisible()
expect(screen.getByRole('button', { name: /update outcome/i })).toBeVisible()
expect(screen.getByRole('button', { name: /edit details/i })).toBeVisible()
expect(screen.getByRole('button', { name: /delete/i })).toHaveClass('property-details__danger')
expect(document.querySelector('.maplibregl-popup')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the test and confirm it fails on the current popup/sheet contract**

Run: `npm test -- src/pages/MapPage.test.tsx`

Expected: FAIL because the desktop details surface is not a complementary panel and the popup path still exists.

- [ ] **Step 3: Implement the shared responsive surface**

Render the component with:

```tsx
<aside className="property-details" aria-label="Property details">
  <header className="property-details__header">
    <span>{pinOutcomeLabel(pin.outcome)}</span>
    <button type="button" onClick={onClose} aria-label="Close property details">×</button>
  </header>
  <section aria-labelledby="property-address">
    <h2 id="property-address">{pin.address || 'Unknown property'}</h2>
  </section>
  {(pin.contactName || pin.contactPhone || pin.contactEmail) && (
    <section aria-labelledby="contact-details">
      <h3 id="contact-details">Contact</h3>
      {pin.contactName && <span>{pin.contactName}</span>}
      {pin.contactPhone && <a href={`tel:${pin.contactPhone}`}>{pin.contactPhone}</a>}
      {pin.contactEmail && <a href={`mailto:${pin.contactEmail}`}>{pin.contactEmail}</a>}
    </section>
  )}
  {pin.notes && (
    <section aria-labelledby="visit-notes">
      <h3 id="visit-notes">Visit notes</h3>
      <p>{pin.notes}</p>
    </section>
  )}
  <div className="property-details__actions">
    <button type="button" onClick={onUpdateOutcome}>Update outcome</button>
    <button type="button" onClick={onEdit}>Edit details</button>
  </div>
  <button className="property-details__danger" type="button" onClick={onDelete}>Delete pin</button>
</aside>
```

Make the full address the heading, keep outcome and rep metadata scannable, omit empty groups, and order actions as Update outcome, Edit details, then Delete. Remove MapLibre popup creation and popup event wiring from `MapPage.tsx`. When selecting on desktop, call `map.easeTo` with a horizontal offset that preserves the selected pin in the visible map area; do not recenter on close.

CSS presents a 360px ivory right panel at widths above 900px and a rounded top bottom sheet at 900px and below. Preserve 44px targets, safe-area padding, internal scrolling, and visible focus states.

- [ ] **Step 4: Run the complete map test file**

Run: `npm test -- src/pages/MapPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the selected-property checkpoint**

```powershell
git add src/components/SelectedPinSheet.tsx src/components/SelectedPinSheet.css src/pages/MapPage.tsx src/pages/MapPage.test.tsx
git commit -m "feat: add structured property details panel"
```

### Task 4: Premium map framing and control hierarchy

**Files:**
- Modify: `src/pages/MapPage.tsx`
- Modify: `src/pages/MapPage.css`
- Modify: `src/components/MapFeedback.css`
- Test: `src/pages/MapPage.test.tsx`

**Interfaces:**
- Consumes: existing search, filter, rep, add, sync, export, placement, and feedback handlers.
- Produces: unchanged behaviour with `.map-workspace`, `.map-toolbar`, `.map-toolbar__filters`, and `.map-actions` presentation groups.

- [ ] **Step 1: Add a failing control-group semantics test**

```tsx
expect(screen.getByRole('search', { name: /map search and filters/i })).toBeVisible()
expect(screen.getByRole('group', { name: /map actions/i })).toBeVisible()
```

- [ ] **Step 2: Run the targeted test and confirm the new landmarks are missing**

Run: `npm test -- src/pages/MapPage.test.tsx`

Expected: FAIL on missing search/group landmarks.

- [ ] **Step 3: Add semantic wrappers and premium styling**

Retain all handler wiring. Add `role="search" aria-label="Map search and filters"` around search/filter controls and `role="group" aria-label="Map actions"` around Add Pin, Sync, and Export. Style a fine gold-framed map workspace, warm toolbar surface, compact outcome chips, consistent rep selector, premium feedback toast, and clear placement prompt. Keep the map dominant and avoid decorative overlays that obscure tiles.

- [ ] **Step 4: Run the map tests**

Run: `npm test -- src/pages/MapPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the map workspace checkpoint**

```powershell
git add src/pages/MapPage.tsx src/pages/MapPage.css src/components/MapFeedback.css src/pages/MapPage.test.tsx
git commit -m "feat: refine premium map workspace"
```

### Task 5: Dashboard premium hierarchy

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.css`
- Create: `src/pages/DashboardPage.test.tsx` if no focused page test exists

**Interfaces:**
- Consumes: existing pins, outcome aggregation, date filters, permissions, and export behaviour.
- Produces: `.dashboard-summary`, `.metric-card`, and `.dashboard-panel` presentation while preserving calculations.

- [ ] **Step 1: Write a failing structural test**

```tsx
expect(screen.getByRole('heading', { name: /dashboard/i })).toBeVisible()
expect(screen.getByRole('region', { name: /performance summary/i })).toHaveClass('dashboard-summary')
```

- [ ] **Step 2: Run the dashboard test and confirm the region contract fails**

Run: `npm test -- src/pages/DashboardPage.test.tsx`

Expected: FAIL because the premium summary region is absent.

- [ ] **Step 3: Implement presentation-only dashboard structure**

Wrap existing metrics in `<section className="dashboard-summary" aria-label="Performance summary">`. Use ivory metric cards, serif figures, compact labels, semantic outcome accents, warm panel borders, and responsive two/one-column layouts. Do not change aggregation, filtering, permission, or export code.

- [ ] **Step 4: Run the dashboard test**

Run: `npm test -- src/pages/DashboardPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the dashboard checkpoint**

```powershell
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.css src/pages/DashboardPage.test.tsx
git commit -m "feat: refine premium dashboard"
```

### Task 6: Premium user administration panel

**Files:**
- Modify: `src/pages/AdminUsersPage.tsx`
- Modify: `src/pages/AdminUsersPage.css`
- Modify: `src/pages/AdminUsersPage.test.tsx`

**Interfaces:**
- Consumes: existing user list, role changes, activation/deactivation, name editing, and add-user handlers.
- Produces: `.user-management`, `.user-row`, status badges, grouped actions, and responsive user-card layout.

- [ ] **Step 1: Write a failing management-panel test**

```tsx
expect(screen.getByRole('region', { name: /user management/i })).toBeVisible()
expect(screen.getByText(/users$/i)).toBeVisible()
expect(screen.getByRole('button', { name: /add user/i })).toBeVisible()
```

- [ ] **Step 2: Run the admin test and confirm the region/count contract fails**

Run: `npm test -- src/pages/AdminUsersPage.test.tsx`

Expected: FAIL because the current exposed table lacks the management region/count hierarchy.

- [ ] **Step 3: Implement the management panel without changing handlers**

Add a page overline/title/description, a `<section className="user-management" aria-label="User management">`, a header containing `${users.length} users`, and the existing Add user action. Retain semantic table markup on desktop, align all columns, style role selects and active/disabled badges, and group Edit/Activate/Deactivate actions. At 700px and below, use CSS grid to present each table row as a labelled user card without horizontal overflow.

- [ ] **Step 4: Run the admin tests**

Run: `npm test -- src/pages/AdminUsersPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the admin checkpoint**

```powershell
git add src/pages/AdminUsersPage.tsx src/pages/AdminUsersPage.css src/pages/AdminUsersPage.test.tsx
git commit -m "feat: refine premium user administration"
```

### Task 7: Settings and login visual alignment

**Files:**
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/SettingsPage.css`
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/pages/LoginPage.css`
- Modify: `src/pages/LoginPage.test.tsx`

**Interfaces:**
- Consumes: existing settings controls and authentication handlers.
- Produces: shared premium form/card language and a responsive navy/ivory login composition.

- [ ] **Step 1: Write a failing login composition test**

```tsx
expect(screen.getByRole('main')).toHaveClass('login-experience')
expect(screen.getByRole('heading', { name: /sign in/i })).toBeVisible()
```

- [ ] **Step 2: Run the login test and confirm the composition class fails**

Run: `npm test -- src/pages/LoginPage.test.tsx`

Expected: FAIL because the new login composition class is absent.

- [ ] **Step 3: Apply the shared premium form language**

Keep auth and settings handlers unchanged. Add `login-experience` to the main login surface and implement a responsive navy brand panel plus ivory sign-in panel, serif heading, restrained gold divider, and factual trust copy only. Group settings into titled ivory sections with concise descriptions and globally consistent labels, controls, focus states, and feedback surfaces. Collapse login to one column below 800px.

- [ ] **Step 4: Run login and full unit tests**

Run: `npm test -- src/pages/LoginPage.test.tsx`

Expected: PASS.

Run: `npm test`

Expected: all test files PASS.

- [ ] **Step 5: Commit the settings/login checkpoint**

```powershell
git add src/pages/SettingsPage.tsx src/pages/SettingsPage.css src/pages/LoginPage.tsx src/pages/LoginPage.css src/pages/LoginPage.test.tsx
git commit -m "feat: align settings and login experience"
```

### Task 8: Responsive, accessibility, and release verification

**Files:**
- Modify only files proven necessary by verification findings.

**Interfaces:**
- Consumes: completed premium interface implementation.
- Produces: verified release candidate with no known UI regression in the scoped routes.

- [ ] **Step 1: Run automated verification**

```powershell
npm test
npm run lint
npm run build
```

Expected: tests and build exit 0; lint exits 0 with no new warnings introduced by this work.

- [ ] **Step 2: Run browser QA on every route**

Start the existing local dev command and inspect `/login`, `/map`, `/dashboard`, `/admin/users`, and `/settings`. Verify the selected Property Details panel, update/edit/delete hierarchy, add-pin flow, filters, and navigation.

- [ ] **Step 3: Verify responsive breakpoints**

At 1440px desktop, 768px tablet, 390px phone, and 320px narrow phone, confirm no horizontal overflow, no obscured controls, 44px touch targets, readable headings, internally scrollable panel/sheet, visible selected pin, and unobstructed bottom navigation.

- [ ] **Step 4: Verify accessibility and runtime health**

Keyboard through navigation, map controls, selected-property actions, forms, and table/card actions. Confirm visible focus, appropriate landmark names, reduced-motion behaviour, and no browser console errors.

- [ ] **Step 5: Apply only evidence-backed corrections and rerun affected checks**

For each defect, add or update the narrowest regression test where behaviour is involved, run it red, apply the smallest fix, then rerun the affected test plus `npm test`.

- [ ] **Step 6: Commit the verified release state**

```powershell
git status --short
git add src/components/Layout.css src/components/MapFeedback.css src/components/MapMarker.css src/components/PinModal.css src/components/SelectedPinSheet.css src/pages/AdminUsersPage.css src/pages/DashboardPage.css src/pages/LoginPage.css src/pages/MapPage.css src/pages/SettingsPage.css
git commit -m "fix: polish responsive premium interface"
```

Before committing, remove any listed CSS path that Task 8 did not change and confirm no unrelated file is staged. Skip this commit when browser verification requires no corrections.
