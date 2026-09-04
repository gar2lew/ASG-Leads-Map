# Phase 1 Release Stabilisation Design

## Objective

Turn the current `codex/release-polish-super-admin` working tree into a coherent, testable release candidate without changing the app's business scope or beginning the later Firestore pin-sync, reporting, territory, or Jotform phases.

## Current State

- The committed baseline contains the responsive mobile field map, premium interface, and high-contrast theme.
- The working tree adds Firebase authentication, Super Admin user management, backend Admin SDK endpoints, password reset, additional domain logic, and expanded automated tests.
- Unit tests and the production build pass.
- Browser tests contain stale credentials and accessible-name expectations after the Super Admin and navigation changes.
- External Esri tile failures display a blocking overlay and log the complete MapLibre error event, which can produce extremely large test output.
- Lint reports four React warnings, the build reports ineffective dynamic imports, and `git diff --check` reports whitespace errors.
- Generated reports and local session artifacts are not consistently excluded from version control.

## Scope

### Included

1. Align development Super Admin fixtures, visible development guidance, README documentation, and E2E tests around one canonical seeded account.
2. Make map tile failure feedback concise and non-blocking so filters and other application controls remain usable.
3. Make Playwright deterministic by intercepting external map tiles and updating assertions to the current accessible UI contract.
4. Remove the unused MapLibre popup path now superseded by the React property-details panel.
5. Resolve the existing React lint warnings without changing observable behaviour.
6. Restore effective route-level or action-level lazy loading where practical and verify the production bundle warning is reduced.
7. Remove whitespace errors and extend `.gitignore` for generated Playwright, Superpowers, and imported session artifacts.
8. Run the complete unit, lint, build, diff, and Chromium E2E checks.

### Excluded

- Firestore pin CRUD or synchronisation.
- Jotform lead submission.
- Live dashboard metrics.
- Territory assignment.
- New mobile, tablet, or desktop features.
- Firebase deployment or production credential changes.
- Rewriting existing UI or changing the role model.

## Behavioural Decisions

### Canonical development identity

Use `admin@asg.local` / `admin123` as the deterministic development Super Admin fixture. Personal or production email addresses must not be embedded in the development fixture. Documentation, login guidance, unit tests, and E2E helpers must agree with this value.

### Tile error handling

Map tile failures are degraded imagery, not a whole-application failure. The app will show a compact dismissible/retry notice that does not intercept pointer interaction outside the notice. Console output will contain a short stable message rather than serialising the MapLibre event graph.

### Browser test isolation

E2E tests will intercept Esri raster tile requests with a deterministic lightweight response or controlled failure according to the scenario. Tests will assert current accessible names (`Primary navigation`) and must not require headings intentionally hidden at field-device widths.

### Cleanup boundaries

Dead popup code may be removed because the React property-details surface is the sole active path. Hook/lint fixes must preserve pin loading, marker rendering, geocoding, and modal behaviour. Bundle cleanup must not introduce a new dependency or architectural rewrite.

## Verification Contract

Phase 1 is complete only when:

- `npm test` exits 0 with all Vitest tests passing.
- `npm run lint` exits 0 without warnings.
- `npm run build` exits 0.
- `npx playwright test --project=chromium` exits 0 with all 64 tests passing.
- `git diff --check` reports no whitespace errors.
- No generated test reports or session archive files appear as new source changes.
- The resulting source/config changes are grouped into focused, reviewable commits or an explicitly reviewed staged sequence.

