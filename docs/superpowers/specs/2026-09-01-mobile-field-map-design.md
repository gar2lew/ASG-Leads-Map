# Mobile Field Map Premium Workflow

## Objective

Deliver a polished, fast field workflow for phone and tablet users without changing the app's existing pin data model, permissions, storage, geocoding, or desktop behaviour.

The primary journey is:

1. Find a property on the map.
2. Enter pin-placement mode and select the exact property.
3. Record the visit outcome in a mobile bottom sheet.
4. Return to the map with confirmation and immediate update/edit actions.

## Scope

### Included

- A map-first mobile layout that gives the map the available viewport height.
- A compact mobile app bar and bottom navigation.
- A floating address/suburb search control.
- Compact, horizontally scrollable outcome filters.
- A thumb-reachable floating Add Pin action.
- Clear pin-placement mode, including visible instructions and cancellation.
- A mobile bottom-sheet presentation for adding and editing pins.
- A selected-pin details sheet with Update Outcome and Edit Details actions.
- Lightweight in-app confirmation after saving a pin.
- Touch targets suitable for coarse pointers.
- Preservation of keyboard access, screen-reader labels, focus behaviour, reduced-motion preferences, and the existing desktop presentation.

### Excluded from this release

- Changes to Firebase, authentication, roles, Firestore rules, or the pin schema.
- New activity-feed functionality behind the proposed navigation label.
- New sync infrastructure.
- Replacing the existing map provider or geocoder.
- Rebuilding the desktop dashboard or settings pages.
- Broad visual-system refactoring outside the map and pin workflow.

## Interaction Design

### Map home

On field-sized screens, the current page title and desktop action/filter rows collapse into map overlays. Search sits near the top, outcome filters remain quickly accessible, and Add Pin sits above the bottom navigation within comfortable thumb reach. The map remains the dominant surface.

The mobile bottom navigation exposes Map as the active destination. Inactive destinations are rendered only when they lead to an existing route; the release must not introduce non-functional navigation.

### Search

Typing an address or suburb filters known pins by their stored address. Matching pins remain visible and the result count updates. Clearing the field restores all pins. Search must not pretend to provide remote address lookup or map navigation when that capability is unavailable.

### Placement mode

Tapping Add Pin changes the interface into an explicit placement state. The app displays a short instruction, provides a visible Cancel action, changes the Add Pin button state, and keeps Escape cancellation for keyboard users. Selecting the map sets the provisional coordinates and opens the add-pin sheet.

### Add and edit sheet

On mobile, the existing PinModal content is presented as a bottom sheet with a drag-handle affordance, a sticky title area, scrollable form content, and sticky actions. The form rules remain unchanged:

- Address confirmation remains required.
- Lead-specific contact fields appear only for the Lead outcome.
- Existing validation and reverse-geocoding states remain visible.
- Closing the sheet returns to the map without saving.

Desktop and wider tablet viewports retain the centred dialog.

### Selected pin

Selecting a marker opens a React-rendered bottom details sheet on mobile rather than relying on a small map popup. It shows the address, outcome, relevant lead contact details, and two primary actions: Update Outcome and Edit Details. Delete remains available as a lower-emphasis destructive action with confirmation.

Desktop retains a compact map popup, but its actions may share the same React handlers used by the sheet.

### Save feedback

After a successful save, the sheet closes, the pin list refreshes, and a non-blocking confirmation appears over the map. The confirmation is announced through a polite live region and dismisses automatically. Failure remains visible and actionable; browser `alert` should be replaced with an inline or toast-style error message in the same feedback system.

## Component Boundaries

- `MapPage` owns pins, filters, search, placement state, selection state, persistence operations, and map coordination.
- `PinModal` continues to own pin form values, validation, reverse-geocoding presentation, and submission.
- A small map toolbar component may be extracted if needed to keep mobile/desktop controls readable.
- A selected-pin sheet component owns presentation only and receives the selected pin plus action callbacks.
- A lightweight map feedback component renders success and error notices.

No new global state store is needed.

## Data Flow

1. Pins load through the existing domain functions.
2. Search, outcome, and rep filters derive one filtered pin collection.
3. The marker renderer and visible result count consume that same collection.
4. Selecting a marker stores its pin ID; the selected pin is derived from current pin state.
5. Adding or editing uses the existing create/save functions.
6. A successful save reloads pins, clears transient placement/editing state, and publishes confirmation feedback.
7. A failed save leaves recoverable form data in place and publishes error feedback.

## Responsive Behaviour

- Field layout activates through CSS media/coarse-pointer rules without JavaScript viewport branching where possible.
- Controls provide effective touch targets of approximately 44 by 44 pixels.
- Bottom overlays account for safe-area insets.
- Sheets and controls fit at 320 CSS pixels without horizontal overflow.
- Desktop layout and behaviour remain available at wider viewports.

## Testing

Tests are written before production changes and must cover:

- Address search filters pins and clearing restores them.
- Add Pin enters placement mode and Cancel exits it.
- Saving publishes confirmation and returns to the map.
- Save failure presents recoverable in-app feedback.
- Selecting a pin exposes Update Outcome and Edit Details actions.
- Existing add/edit, validation, geocoding, role, and export tests remain green.

Verification for the release:

- Targeted Vitest tests for changed behaviour.
- Full `npm test`.
- `npm run lint`.
- `npm run build`.
- Browser verification at phone and tablet viewport sizes, including the main add-pin and edit-pin journeys.

## Risks and Safeguards

- MapLibre creates marker DOM outside React. Selection remains ID-based and all marker listeners must be removed when markers are rebuilt.
- Mobile overlays can obscure map controls. Their positions must account for the bottom navigation, safe-area insets, and existing MapLibre controls.
- The working tree already contains significant user changes. Implementation must use focused patches and must not reformat or replace unrelated work.
- Existing placeholder controls must not be made more prominent unless they become functional in this release.

## Acceptance Criteria

- A rep can add and save a pin on a phone without navigating away from the map.
- The primary actions are reachable and readable with one-handed use.
- Search visibly affects the pins shown and never implies unsupported remote search.
- Pin selection and editing do not depend on tiny popup controls on mobile.
- Success and failure feedback stays inside the app.
- Existing pin persistence, outcome rules, geocoding, permissions, desktop layout, and automated tests continue to work.
