# Multi-Workspace Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give authorised users a clear post-login choice of Leads Map, Leads Import, and Lead Contact Management, with task-focused navigation and shared premium styling.

**Architecture:** Keep one React application, Firebase identity, and authenticated layout, but add a capability-filtered workspace chooser and workspace-aware navigation. Existing routes remain compatible deep links; workspace-specific landing pages launch functions backed by the shared Firestore register from the data plan.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Firebase Auth/Firestore, Vite, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-multi-workspace-app-design.md`

## Global Constraints

- Keep one Firebase identity/project; do not duplicate accounts or workspaces as separate deployments.
- Preserve existing routes `/map`, `/dashboard`, `/calls`, `/admin/import`, `/admin/users`, `/admin/territories`, and `/settings`.
- Workspace cards, navigation, and deep-linked routes must use existing capability checks and fail closed while profile access resolves.
- Preserve deep links through sign-in and do not discard an unsaved form or import preview when switching workspaces.
- Apply the approved ASG navy, warm ivory, restrained gold visual system consistently in both themes; inputs, placeholders, errors, selected states, focus, and contrast stay readable.
- Maintain responsive desktop/mobile layouts and keyboard/touch access.

## Review Focus

- Auth/profile still resolving must show no restricted cards or nav links; cover in `src/components/RouteGuards.test.tsx`.
- Directly opening an unauthorised route must not grant access; cover in route-guard tests.
- Sign-in return URL must preserve a valid deep link but reject unsafe/external destinations; cover in auth/routing tests.
- Workspace switching with a dirty form/import preview must retain or warn before leaving; cover in workspace page tests.
- Light and dark theme controls must meet legibility expectations on focus, invalid, selected, and placeholder states; cover in `src/components/Layout.test.tsx` and visual smoke tests.

---

### Task 1: Add workspace model and capability selection

**Files:**
- Create: `src/domain/workspaces.ts`
- Test: `src/domain/workspaces.test.ts`
- Read/modify as needed: `src/domain/roles.ts`

**Interfaces:**
- Export `WorkspaceId = 'map' | 'import' | 'contacts'` and `getAvailableWorkspaces(user): WorkspaceDefinition[]`.
- Definitions include stable ID, title, description, landing route, and required capability; use existing role/capability helpers as the sole authorization source.

- [ ] Test each existing role's exact workspace set, inactive user behavior, and empty/unresolved profile behavior.
- [ ] Run `npm test -- src/domain/workspaces.test.ts`; confirm new cases fail.
- [ ] Implement typed workspace definitions without changing role assignments.
- [ ] Run targeted tests; expect PASS.
- [ ] Commit as `feat: define capability-aware workspaces`.

### Task 2: Implement chooser and post-login routing

**Files:**
- Create: `src/pages/WorkspaceHomePage.tsx`
- Test: `src/pages/WorkspaceHomePage.test.tsx`
- Modify: `src/App.tsx`
- Test: relevant route/auth tests under `src`
- Read/modify: auth redirect handling in `src/auth/AuthProvider.tsx` and `src/pages/LoginPage.tsx` only if needed.

**Interfaces:**
- Add authenticated `/workspaces` route and use it as the default post-login destination only when there is no validated deep link.
- Keep explicit safe deep links and all legacy route aliases functional.

- [ ] Test post-login chooser, deep-link preservation, unauthorised route handling, and redirect target allowlisting.
- [ ] Run targeted chooser/routing tests; confirm new cases fail.
- [ ] Implement chooser cards using `getAvailableWorkspaces(user)` and guarded route handling.
- [ ] Run route tests and `npm run build`; expect PASS.
- [ ] Commit as `feat: add post-login workspace chooser`.

### Task 3: Make the authenticated shell workspace-aware

**Files:**
- Modify: `src/components/Layout.tsx`
- Test: `src/components/Layout.test.tsx`
- Modify: `src/components/RouteGuards.tsx`
- Test: `src/components/RouteGuards.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Resolve active workspace from the route, filter nav items with the same capabilities as route guards, and expose a workspace switcher linking to `/workspaces`.
- Keep shared account actions, theme setting, and responsive menu available in every workspace.

- [ ] Test active workspace nav, role restrictions, switcher behavior, loading state, and legacy routes.
- [ ] Run targeted layout/guard tests; confirm new cases fail.
- [ ] Implement workspace-aware nav and add a back/switch path from every landing page.
- [ ] Run targeted tests; expect PASS.
- [ ] Commit as `feat: add workspace-aware application navigation`.

### Task 4: Create task-focused workspace dashboards

**Files:**
- Modify: `src/pages/MapPage.tsx`
- Test: `src/pages/MapPage.test.tsx`
- Modify: `src/pages/LeadImportPage.tsx`
- Test: `src/pages/LeadImportPage.test.tsx`
- Modify: `src/pages/call-centre/CallCentreSummary.tsx`
- Test: `src/pages/call-centre/QuickCapturePanel.test.tsx` (plus a focused summary test if absent)
- Modify: `src/pages/DashboardPage.tsx`
- Test: `src/pages/DashboardPage.test.tsx` (create if absent).

**Interfaces:**
- Map landing prioritises territory/map operations; Import landing prioritises source status, baseline/refresh, validation and duplicate review; Contact landing prioritises open leads, today's activity, callbacks, field results, qualified and Timely-sent work.
- All workspace summary data comes from the shared Firestore repository in the lead-register plan; do not create a parallel local data source.

- [ ] Test each landing page's primary action routes and shared-record summary data, with empty/loading/error states; preserve the existing map, import, and call-centre page components rather than duplicating workflow logic.
- [ ] Run targeted page tests; confirm new cases fail.
- [ ] Compose focused dashboards with existing page capabilities; avoid duplicating map/import/contact domain logic.
- [ ] Run page tests and `npm run build`; expect PASS.
- [ ] Commit as `feat: add focused workspace dashboards`.

### Task 5: Normalize visual tokens and verify both themes

**Files:**
- Modify: `src/components/design-system.css`
- Modify: `src/components/Layout.css`
- Modify: `src/components/premium-surfaces.css`
- Modify: `src/pages/call-centre/CallCentreWorkspace.css`
- Modify: `src/pages/LeadImportPage.css`
- Test: `src/components/Layout.test.tsx` plus Playwright visual smoke coverage.

**Interfaces:**
- Use central theme tokens for navy, ivory, gold, text, muted text, borders, focus, success/warning/error, input/background and selected states; do not scatter page-specific hardcoded overrides.
- Preserve the user's dark/light selection and ensure both apply consistently across the chooser and all three existing workspaces.

- [ ] Add tests or Playwright assertions for readable text/inputs/placeholders/focus/error/selected states in both themes and desktop/mobile widths.
- [ ] Run the relevant tests; confirm failures for known contrast regressions.
- [ ] Implement central token corrections and replace only conflicting workspace overrides.
- [ ] Run `npm test`, `npm run lint`, and `npm run build`; expect PASS; visually smoke test both themes and responsive nav in Vercel Preview.
- [ ] Commit as `fix: unify workspace theme contrast and tokens`.
