# Mobile Field Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing map-and-pin workflow fluid and touch-friendly on field phones and tablets while preserving its data model and desktop behaviour.

**Architecture:** Keep `MapPage` as the state and MapLibre coordinator, derive one searched/filtered pin collection, and add small presentational components for map feedback and selected-pin actions. Keep `PinModal`'s validation and geocoding logic intact while changing its field-device presentation through semantic markup and responsive CSS.

**Tech Stack:** React 19, TypeScript 6, React Router 7, MapLibre GL 6, Vitest 4, Testing Library, Playwright, CSS.

**Spec:** `docs/superpowers/specs/2026-09-01-mobile-field-map-design.md`

## Global Constraints

- Preserve Firebase, authentication, roles, Firestore rules, pin schema, storage, geocoder, and desktop behaviour.
- Do not add a new global state store or a new UI dependency.
- Do not expose non-functional Activity or More navigation actions.
- Keep effective field-device touch targets approximately 44 by 44 CSS pixels and support 320 CSS pixel widths.
- Account for mobile safe-area insets and reduced-motion preferences.
- Preserve all existing user changes; patch only files required by this plan.

---

### Task 1: Functional pin search and unified filtering

**Files:**
- Modify: `src/pages/MapPage.tsx`
- Test: `src/pages/MapPage.test.tsx`

**Interfaces:**
- Consumes: existing `Pin` fields `address`, `outcome`, and `createdBy`.
- Produces: `searchQuery: string` state and one `filteredPins: Pin[]` collection shared by marker rendering and the visible result count.

- [ ] **Step 1: Write the failing search test**

Add a test using two real pin fixtures with distinct stored addresses:

```tsx
it('filters visible pins by stored address and restores them when search is cleared', async () => {
  mockPins.push(
    createStoredPin({ id: 'oceanview', address: '18 Oceanview Road, Cottesloe WA 6011' }),
    createStoredPin({ id: 'hay', address: '123 Hay Street, Perth WA 6000' }),
  )
  const user = userEvent.setup()
  render(<BrowserRouter><MapPage /></BrowserRouter>)

  const search = await screen.findByRole('searchbox', { name: /search address or suburb/i })
  await user.type(search, 'Cottesloe')
  expect(screen.getByText('Showing 1 of 2 pins')).toBeInTheDocument()

  await user.clear(search)
  expect(screen.getByText('Showing 2 of 2 pins')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/pages/MapPage.test.tsx -t "filters visible pins"`

Expected: FAIL because the search input is uncontrolled and does not affect the result count.

- [ ] **Step 3: Implement one filtered pin collection**

Add `searchQuery` state, derive trimmed lowercase query text, and filter once:

```tsx
const [searchQuery, setSearchQuery] = useState('')

const filteredPins = pins.filter((pin) => {
  if (outcomeFilter && pin.outcome !== outcomeFilter) return false
  if (repFilter === 'me' && pin.createdBy !== currentUser.uid) return false
  const query = searchQuery.trim().toLocaleLowerCase()
  if (query && !pin.address?.toLocaleLowerCase().includes(query)) return false
  return true
})
```

Make the search input controlled. Pass `filteredPins` into marker rendering or make `renderPins` consume that collection so the map and count cannot disagree. Include the collection in the marker-rendering effect dependencies.

- [ ] **Step 4: Run the focused test and existing map tests**

Run: `npm test -- src/pages/MapPage.test.tsx -t "filters visible pins"`

Expected: PASS.

Run: `npm test -- src/pages/MapPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the behaviour**

```powershell
git add -- src/pages/MapPage.tsx src/pages/MapPage.test.tsx
git commit -m "feat: add functional map pin search"
```

---

### Task 2: Placement mode and in-app feedback

**Files:**
- Create: `src/components/MapFeedback.tsx`
- Create: `src/components/MapFeedback.css`
- Modify: `src/pages/MapPage.tsx`
- Test: `src/pages/MapPage.test.tsx`

**Interfaces:**
- Produces: `MapFeedback({ feedback, onDismiss }: { feedback: { kind: 'success' | 'error'; message: string } | null; onDismiss(): void })`.
- Consumes: existing `isAddingPin`, `handleSavePin`, and `removeProvisionalMarker` behaviour.

- [ ] **Step 1: Write failing tests for visible cancellation and save feedback**

```tsx
it('cancels placement mode from the visible cancel action', async () => {
  const user = userEvent.setup()
  render(<BrowserRouter><MapPage /></BrowserRouter>)
  await user.click(await screen.findByRole('button', { name: /add pin/i }))
  await user.click(screen.getByRole('button', { name: /cancel pin placement/i }))
  expect(screen.queryByText(/tap the exact property/i)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /add pin/i })).toHaveAttribute('aria-pressed', 'false')
})

it('shows in-app confirmation after a pin is saved', async () => {
  // Enter placement, trigger the map click, complete required form values,
  // submit through the real PinModal, then assert the page-level feedback.
  expect(await screen.findByRole('status')).toHaveTextContent('Pin saved')
  expect(screen.queryByRole('dialog', { name: /add new pin/i })).not.toBeInTheDocument()
})
```

For the success test, reuse the file's existing map-click and PinModal form helpers so it exercises the real component rather than a modal mock.

- [ ] **Step 2: Run both tests and verify RED**

Run: `npm test -- src/pages/MapPage.test.tsx -t "cancels placement|in-app confirmation"`

Expected: FAIL because no visible placement-cancel button or page-level feedback exists.

- [ ] **Step 3: Implement placement cancellation and feedback**

Create the presentational feedback component:

```tsx
export type MapFeedbackValue = {
  kind: 'success' | 'error'
  message: string
}

export function MapFeedback({ feedback, onDismiss }: {
  feedback: MapFeedbackValue | null
  onDismiss: () => void
}) {
  if (!feedback) return null
  return (
    <div className={`map-feedback map-feedback--${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>
      <span>{feedback.message}</span>
      <button type="button" className="map-feedback__dismiss" onClick={onDismiss} aria-label="Dismiss message">×</button>
    </div>
  )
}
```

In `MapPage`, add a `cancelPinPlacement` callback that resets placement state and removes the provisional marker. Use it for Escape, the visible Cancel action, and after a location is chosen. Publish `{ kind: 'success', message: editingPin ? 'Pin updated' : 'Pin saved' }` after persistence succeeds. Publish an error message without closing the form when persistence fails. Auto-dismiss success after a short timeout and clear the timer on unmount.

- [ ] **Step 4: Run the focused and full map tests**

Run: `npm test -- src/pages/MapPage.test.tsx -t "cancels placement|in-app confirmation"`

Expected: PASS.

Run: `npm test -- src/pages/MapPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the behaviour**

```powershell
git add -- src/components/MapFeedback.tsx src/components/MapFeedback.css src/pages/MapPage.tsx src/pages/MapPage.test.tsx
git commit -m "feat: improve map placement feedback"
```

---

### Task 3: React selected-pin action sheet

**Files:**
- Create: `src/components/SelectedPinSheet.tsx`
- Create: `src/components/SelectedPinSheet.css`
- Modify: `src/pages/MapPage.tsx`
- Test: `src/pages/MapPage.test.tsx`

**Interfaces:**
- Consumes: `pin: Pin`, `onUpdateOutcome()`, `onEdit()`, `onDelete()`, and `onClose()` callbacks.
- Produces: a React-rendered `aside` labelled `Selected property`, with `Update outcome`, `Edit details`, and `Delete pin` buttons.

- [ ] **Step 1: Write the failing selected-pin action test**

```tsx
it('shows touch-friendly actions when a marker is selected', async () => {
  mockPins.push(createStoredPin({ id: 'selected', address: '18 Oceanview Road' }))
  render(<BrowserRouter><MapPage /></BrowserRouter>)
  const marker = await findMarkerByLabel(/18 Oceanview Road/i)
  fireEvent.click(marker)

  const sheet = await screen.findByRole('complementary', { name: /selected property/i })
  expect(within(sheet).getByRole('button', { name: /update outcome/i })).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: /edit details/i })).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: /delete pin/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/pages/MapPage.test.tsx -t "touch-friendly actions"`

Expected: FAIL because selection currently creates only MapLibre popup HTML outside React.

- [ ] **Step 3: Implement the selected-pin sheet**

Build `SelectedPinSheet` from semantic React elements. Derive `selectedPin` in `MapPage` from `selectedPinId` and current pins. On marker selection, keep the desktop popup but also render the sheet; hide the sheet at desktop widths through CSS. Wire Update Outcome and Edit Details to open `PinModal` with the selected pin. Wire delete to the existing confirmation and delete behaviour, then clear selection.

Avoid querying `.map-popup` for mobile actions. Keep the desktop popup listener path until a focused later refactor is justified.

- [ ] **Step 4: Run the focused and full map tests**

Run: `npm test -- src/pages/MapPage.test.tsx -t "touch-friendly actions"`

Expected: PASS.

Run: `npm test -- src/pages/MapPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the component**

```powershell
git add -- src/components/SelectedPinSheet.tsx src/components/SelectedPinSheet.css src/pages/MapPage.tsx src/pages/MapPage.test.tsx
git commit -m "feat: add mobile selected pin actions"
```

---

### Task 4: Mobile map-first layout and bottom-sheet form

**Files:**
- Modify: `src/pages/MapPage.tsx`
- Modify: `src/pages/MapPage.css`
- Modify: `src/components/PinModal.tsx`
- Modify: `src/components/PinModal.css`
- Modify: `src/components/Layout.tsx`
- Modify: `src/components/Layout.css`
- Modify: `src/index.css`
- Test: `src/pages/MapPage.test.tsx`
- Test: `src/components/PinModal.test.tsx`

**Interfaces:**
- Consumes: existing map controls, filters, modal fields, validation, and submit callbacks.
- Produces: field-device class hooks `map-page__mobile-bar`, `map-page__floating-search`, `map-page__mobile-filters`, `map-page__add-fab`, `app__mobile-nav`, and bottom-sheet modal styling.

- [ ] **Step 1: Add failing semantic tests for the field controls and sheet**

```tsx
it('exposes the map controls through mobile-friendly semantic regions', async () => {
  render(<BrowserRouter><MapPage /></BrowserRouter>)
  expect(await screen.findByRole('searchbox', { name: /search address or suburb/i })).toBeInTheDocument()
  expect(screen.getByRole('toolbar', { name: /map filters/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /add pin/i })).toHaveClass('map-page__add-fab')
})
```

Extend the existing PinModal test to assert that the real dialog contains a `pin-modal__sheet` surface and that its Cancel and Save actions remain accessible after the markup adjustment.

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- src/pages/MapPage.test.tsx src/components/PinModal.test.tsx -t "mobile-friendly|sheet surface"`

Expected: FAIL because the new structural classes and sheet surface do not exist.

- [ ] **Step 3: Implement responsive markup and CSS**

Restructure only the necessary `MapPage` controls into desktop and mobile class hooks while keeping one accessible search input and one Add Pin button in the DOM. Use CSS media queries to:

- Make authenticated app content edge-to-edge on the map route at field widths.
- Hide the desktop page title/subtitle and low-priority placeholder Sync action on field widths.
- Overlay search and compact filters over the map.
- Keep the Add Pin action above a safe-area-aware mobile navigation area.
- Let the map fill the remaining viewport and avoid document-level scrolling during normal map use.
- Keep MapLibre navigation controls clear of app overlays.
- Present `.pin-modal__sheet` from the bottom with scrollable content and sticky actions at field widths, while retaining the centred desktop dialog.
- Use existing design tokens, restrained shadows, and the navy/gold ASG palette.

Add a mobile nav in `Layout` containing only real destinations available to the current role. Mark Map active via `NavLink`; do not render Activity or More placeholders.

Correct the invalid period-terminated declarations already present in the touched high-contrast sections of `src/index.css`, because they prevent those accessibility tokens and base declarations from parsing.

- [ ] **Step 4: Run component tests**

Run: `npm test -- src/pages/MapPage.test.tsx src/components/PinModal.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the responsive UI**

```powershell
git add -- src/pages/MapPage.tsx src/pages/MapPage.css src/components/PinModal.tsx src/components/PinModal.css src/components/Layout.tsx src/components/Layout.css src/index.css src/pages/MapPage.test.tsx src/components/PinModal.test.tsx
git commit -m "feat: add premium mobile field map layout"
```

---

### Task 5: Release verification

**Files:**
- Modify only files required to fix regressions introduced by Tasks 1–4.

**Interfaces:**
- Consumes: the completed mobile field workflow.
- Produces: passing automated verification and recorded phone/tablet browser evidence.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: all Vitest tests pass with no unhandled errors.

- [ ] **Step 2: Run static checks**

Run: `npm run lint`

Expected: exit code 0.

Run: `npm run build`

Expected: TypeScript and Vite build successfully.

- [ ] **Step 3: Run browser verification at field sizes**

Start the existing Vite development server and use browser verification at 390 by 844 and 768 by 1024 CSS pixels. Verify:

- Sign-in and route loading complete without console errors.
- Map dominates the screen and MapLibre controls remain usable.
- Search filters stored pins and clearing restores them.
- Add Pin enters placement mode and Cancel exits it.
- Selecting a location opens the bottom-sheet form.
- Address/geocoding feedback, outcome selection, lead-only fields, and validation remain usable.
- Saving returns to the map with confirmation.
- Selecting an existing pin reveals update and edit actions.
- No control overlaps safe areas or clips at 320 CSS pixels.

- [ ] **Step 4: Inspect the focused diff**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only the pre-existing user work plus the intended task changes; no generated browser reports or temporary companion files are staged.

- [ ] **Step 5: Commit verification fixes if any were required**

```powershell
git add -- src/pages/MapPage.tsx src/pages/MapPage.css src/components/PinModal.tsx src/components/PinModal.css src/components/Layout.tsx src/components/Layout.css src/components/MapFeedback.tsx src/components/MapFeedback.css src/components/SelectedPinSheet.tsx src/components/SelectedPinSheet.css src/index.css src/pages/MapPage.test.tsx src/components/PinModal.test.tsx
git commit -m "fix: resolve mobile field map regressions"
```
