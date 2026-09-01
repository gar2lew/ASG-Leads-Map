# ASG Leads Map Premium Interface System

**Date:** 1 September 2026  
**Status:** Approved for planning

## Objective

Elevate the complete ASG Leads Map interface to the same restrained, premium standard as the ASG Sales Appointment Capture application while preserving all existing routes, permissions, data flows, and field workflows.

The visual language is precision luxury: deep navy structure, warm ivory work surfaces, muted gold accents, editorial headings, operational sans-serif body text, generous spacing, and quiet interaction feedback. The field map remains the primary experience.

## Scope

This pass covers the authenticated application shell, map, selected-pin experience, dashboard, user administration, settings, login, shared forms, cards, buttons, status treatments, and responsive behaviour.

It does not change authentication, permissions, storage, synchronisation, CSV behaviour, lead integration, outcome rules, or routing. Existing functionality must remain intact unless a small semantic wrapper is required for presentation or accessibility.

## Design System

### Colour and surfaces

- Deep navy remains the structural colour for the application background, header, navigation, and high-emphasis controls.
- Warm ivory becomes the primary work surface for cards, tables, panels, forms, and sheets.
- Muted gold is reserved for selected states, primary actions, fine dividers, focus treatment, and small brand details.
- Status colours remain semantic and are never replaced by decorative gold.
- Borders are fine and warm; shadows are broad, soft, and low contrast.

### Typography

- Page titles, important card headings, and key metrics use an editorial serif face.
- Controls, navigation, labels, table data, and body copy retain a highly legible sans-serif face.
- Overlines use compact uppercase sans-serif text with measured letter spacing.
- Heading hierarchy must remain clear at phone, tablet, and desktop sizes.

### Components and interaction

- Buttons have a consistent 44px minimum touch target, clear primary/secondary/danger hierarchy, and restrained hover and pressed states.
- Form controls use warm surfaces, precise borders, persistent labels, visible focus treatment, and helpful error copy.
- Cards use consistent padding, radius, border, and title treatment.
- Motion is short and purposeful. Reduced-motion preferences disable nonessential transitions.
- Keyboard navigation, focus visibility, semantic labels, and colour contrast must be preserved.

## Application Shell

The authenticated shell uses a refined deep-navy header with a compact ASG identity, clearly grouped navigation, a precise active indicator, and a quiet user/role area. Desktop content sits within a generous centred frame. Mobile retains the map-first bottom navigation and touch-friendly controls.

The shell should feel related to the Sales Appointment Capture reference without copying its split-screen composition where that would impair operational use.

## Field Map

The map is presented as the dominant work surface inside a finely framed container. Page title and primary actions sit above it, while search, outcome filters, rep selection, and pin count form a compact, clearly ordered control deck.

On mobile and tablet, the existing map-first layout remains. Search and filter controls float above the map, the Add Pin action remains immediately reachable, and the bottom navigation remains fixed without obscuring map controls.

### Markers

There is one marker style source of truth. Existing competing marker declarations are consolidated.

- Every saved marker is a solid 36–40px teardrop filled with its outcome colour.
- The marker uses a crisp ivory centre glyph or inset and a subtle navy shadow so it remains legible on satellite imagery.
- Normal markers do not pulse or use translucent fills.
- The selected marker receives a restrained ivory-and-gold selection ring and a slight lift.
- A provisional placement marker is visually distinct but remains solid and legible.
- Marker status colours continue to come from the domain outcome mapping.

### Selected property details

The small MapLibre popup is removed as the primary details interface.

On desktop and tablet, selecting a pin opens a 360px right-side Property Details panel layered over the map. On mobile, the same information hierarchy appears in a bottom sheet. Both variants use one shared React component and data model.

The surface contains:

1. A status-colour accent, outcome badge, close control, and full address heading.
2. Structured groups for visit details, representative, contact information, notes, and timestamps. Empty groups are omitted.
3. A primary Update outcome action.
4. A secondary Edit details action.
5. Delete placed in a visually subdued danger area and retaining its existing confirmation behaviour.

When the desktop panel opens, the map smoothly offsets enough to keep the selected pin visible. Closing the panel leaves the current map position intact. Selection remains keyboard accessible.

## Dashboard

The dashboard uses warm ivory metric cards with clear serif figures, compact sans-serif labels, restrained outcome accents, and consistent chart/list containers. Information density remains operational, but spacing and hierarchy make scanning easier. No reporting logic changes.

## User Administration

The exposed table is replaced visually by a titled management panel with user count/context, a clear Add user action, aligned rows, consistent role controls, status badges, and grouped row actions. Empty names and optional team fields must still render predictably. Existing role, activation, and permission behaviour remains unchanged.

At narrow widths, rows become structured user cards rather than forcing horizontal table scrolling.

## Settings

Settings are grouped into titled ivory sections with concise supporting copy. Controls share the global form system, and save/status feedback uses the shared notification treatment. Settings behaviour and persistence do not change.

## Login

The login screen adopts the reference application's balanced navy-and-ivory composition, brand typography, subtle gold detailing, and security/trust language already supported by the product. It remains responsive and does not introduce new authentication claims or functionality.

## Feedback, Loading, and Errors

- Success and error messages remain in-app and use consistent notification surfaces.
- Loading states preserve layout to avoid jumps.
- Empty states explain the next useful action.
- Tile or network errors remain visible without blocking available controls.
- Destructive actions retain explicit confirmation.

## Implementation Boundaries

The implementation should extend the existing token system and shared layout/components rather than rewrite the application. Page CSS may be reorganised only where needed to eliminate conflicting global selectors or establish a single reusable pattern. Unrelated working-tree changes must be preserved.

Marker presentation should be extracted into a small testable renderer or markup helper used by MapLibre and, where still needed, the React marker component. The selected property surface should reuse the current selected-pin logic and handlers rather than duplicate state.

## Verification

Implementation follows test-driven development for behavioural changes:

- Add a regression test proving marker markup receives a solid status-colour body and no default pulse.
- Test selection opens the Property Details surface with the address, outcome, and correct action hierarchy.
- Preserve existing pin, filtering, editing, deletion, auth, and admin tests.
- Run the complete unit test suite, lint, and production build.
- Browser QA the login, map, selected-pin panel/sheet, dashboard, admin users, and settings pages.
- Verify desktop, 768px tablet, 390px phone, and 320px narrow-phone layouts.
- Check keyboard navigation, focus states, horizontal overflow, touch targets, reduced motion, and browser console output.

## Success Criteria

- Pins read immediately as solid, status-coloured map markers at normal field zoom levels.
- A selected property's address and details can be scanned without a cramped floating popup.
- Primary and destructive actions are visually distinct and correctly prioritised.
- Every route feels part of one ASG product and recognisably related to Sales Appointment Capture.
- Existing workflows and permissions continue to pass automated and browser verification.
