# Call Centre Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic call register with a premium, responsive call-centre hub for lead intake, phone calls, door knocks, qualification, callbacks, and explicit Timely CRM handoff.

**Architecture:** Keep the existing `/calls` route and local-storage compatibility, but move row/activity operations behind a typed repository and split the oversized page into focused components. The UI will use a shared semantic theme token layer so the same premium surfaces, controls, badges, and contrast rules apply across map, dashboard, import, and call-centre screens.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, existing localStorage and CSV utilities, CSS custom properties, React Router.

**Spec:** `docs/superpowers/specs/2026-09-24-call-centre-hub-design.md`

## Global Constraints

- Existing CSV imports and local browser data continue to work.
- Timely CRM handoff is an explicit checkbox/trigger; there is no direct Timely API integration.
- The current authentication, map, Firebase, and admin security models remain unchanged.
- Light and dark themes must provide every semantic token and must not use unreadable text/surface combinations.
- Preserve Australian date and phone formatting already used by the app.
- Do not add a runtime dependency.

## Review Focus

- Legacy `asg-call-log` rows with missing new fields must migrate to safe defaults without disappearing.
- CSV files with quoted commas/newlines and partial headers must import without shifting columns.
- A lead with multiple activities must update its latest outcome without overwriting prior activities.
- Unchecking Timely CRM handoff must require confirmation and clear timestamp/user metadata together.
- Narrow mobile screens must keep the capture action, register cards, and navigation usable without horizontal scrolling.

---

### Task 1: Define lead/activity types and repository adapter

**Files:**
- Create: `src/domain/leadRegister.ts`
- Create: `src/domain/leadRegister.test.ts`
- Modify: `src/domain/index.ts`

**Interfaces:**
- Produces `LeadRecord`, `LeadActivity`, `LeadQualification`, `LeadActivityKind`, `migrateLeadRecord`, `appendActivity`, and `filterLeadRecords`.
- `migrateLeadRecord(input: Partial<LeadRecord> & { id: string }): LeadRecord` supplies defaults for legacy rows.
- `appendActivity(record: LeadRecord, activity: LeadActivity): LeadRecord` returns an updated snapshot without mutating the input.
- `filterLeadRecords(records: LeadRecord[], filters: { query?: string; status?: string; rep?: string; office?: string; timely?: 'all' | 'sent' | 'pending'; callbackDue?: boolean }, today: string): LeadRecord[]` returns matching records.

- [ ] **Step 1: Write failing migration and activity tests**

```ts
it('migrates legacy rows and preserves their identity', () => {
  const result = migrateLeadRecord({ id: 'legacy-1', leadName: 'Ava', address: '1 Main St' })
  expect(result.leadStatus).toBe('New')
  expect(result.qualification).toBe('new')
  expect(result.timelySynced).toBe(false)
})

it('appends an activity without deleting the previous activity list', () => {
  const next = appendActivity(recordWithActivities, activity)
  expect(next.activities).toHaveLength(2)
  expect(next.lastActivityAt).toBe(activity.occurredAt)
})
```

- [ ] **Step 2: Run `npm test -- src/domain/leadRegister.test.ts --run` and verify the new tests fail because the module is absent.**
- [ ] **Step 3: Implement immutable types, migration defaults, activity append, and filter predicates.**
- [ ] **Step 4: Run the focused test and then `npm test -- src/domain/leadRegister.test.ts --run`; verify all pass.**
- [ ] **Step 5: Commit with `feat: add lead register domain model`.**

### Task 2: Add local repository and CSV compatibility

**Files:**
- Create: `src/domain/leadRegisterRepository.ts`
- Create: `src/domain/leadRegisterRepository.test.ts`
- Modify: `src/domain/csv.ts`

**Interfaces:**
- Produces `loadLeadRecords()`, `saveLeadRecords(records)`, `addLeadActivity(recordId, activity)`, `setTimelyHandoff(recordId, sent, user)`, `importLeadCsv(text)`, and `exportLeadCsv(records)`.
- The local implementation uses storage key `asg-call-log` and accepts the existing header names.
- `setTimelyHandoff` sets `timelySyncedAt` and `timelySyncedBy` when `sent === true`; it clears both when false.

- [ ] **Step 1: Write tests for legacy storage migration, CSV round-trip, and Timely metadata.**
- [ ] **Step 2: Run the focused repository tests and confirm failure.**
- [ ] **Step 3: Implement the adapter using `csvToArray`, `arrayToCsv`, and `migrateLeadRecord`; preserve unknown CSV columns by ignoring them rather than shifting known values.**
- [ ] **Step 4: Verify quoted commas, empty files, partial headers, and handoff metadata with focused tests.**
- [ ] **Step 5: Commit with `feat: add lead register repository`.**

### Task 3: Build premium call-centre capture components

**Files:**
- Create: `src/pages/call-centre/CallCentreSummary.tsx`
- Create: `src/pages/call-centre/QuickCapturePanel.tsx`
- Create: `src/pages/call-centre/LeadCard.tsx`
- Create: `src/pages/call-centre/LeadRegister.tsx`
- Create: `src/pages/call-centre/CallCentreWorkspace.css`
- Create: `src/pages/call-centre/QuickCapturePanel.test.tsx`

**Interfaces:**
- `QuickCapturePanel` accepts `mode: 'lead' | 'call' | 'door_knock'`, `draft: LeadRecord`, `onChange`, `onSubmit`, and `onModeChange`.
- `LeadCard` accepts `record: LeadRecord`, `onAddActivity`, and `onToggleTimely`.
- `LeadRegister` accepts `records`, `filters`, `onFiltersChange`, `onAddActivity`, and `onToggleTimely`.
- `CallCentreSummary` accepts `records` and computes the six summary metrics from the current filtered office.

- [ ] **Step 1: Write component tests for required identity validation, mode switching, Timely checkbox rendering, and mobile card content.**
- [ ] **Step 2: Run focused component tests and confirm failure.**
- [ ] **Step 3: Implement the capture panel with explicit call/door-knock outcomes, follow-up date, notes, rep, qualification, and Timely handoff controls.**
- [ ] **Step 4: Implement summary cards and lead cards with accessible status chips, action buttons, and no horizontal overflow below 760px.**
- [ ] **Step 5: Implement desktop table rendering and mobile card rendering using the same record/filter props.**
- [ ] **Step 6: Verify focused component tests and commit `feat: add premium call centre components`.**

### Task 4: Replace the existing `/calls` page with the workspace

**Files:**
- Modify: `src/pages/CallLogPage.tsx`
- Modify: `src/pages/CallLogPage.css`
- Modify: `src/pages/CallLogPage.test.tsx` or create it if absent

**Interfaces:**
- The route remains `/calls`.
- The page owns selected capture mode, draft state, repository calls, import summary, search/filter state, and confirmation for Timely uncheck.
- Existing `asg-call-log` data is loaded through the repository and remains visible after upgrade.

- [ ] **Step 1: Add page tests for add lead, add call activity, add door-knock activity, search/filtering, and Timely handoff.**
- [ ] **Step 2: Run the focused page tests and confirm failure against the current one-line register.**
- [ ] **Step 3: Replace the current inline JSX with the four-zone workspace while preserving CSV import/export and existing field meanings.**
- [ ] **Step 4: Add import summary feedback and validation that preserves draft values after errors.**
- [ ] **Step 5: Run focused page tests and commit `feat: replace call log with call centre workspace`.**

### Task 5: Unify premium theme tokens across the app

**Files:**
- Modify: `src/index.css`
- Modify: `src/pages/MapPage.css`
- Modify: `src/pages/DashboardPage.css`
- Modify: `src/pages/LeadImportPage.css`
- Modify: `src/pages/CallLogPage.css`
- Create: `src/theme/theme.test.ts`

**Interfaces:**
- Produces semantic tokens for canvas, surface, raised surface, border, text, muted text, placeholder, gold accent, success, warning, and danger in both light and dark themes.

- [ ] **Step 1: Add token tests that assert both theme selectors define readable text, surface, border, and focus values.**
- [ ] **Step 2: Run the focused theme test and confirm failure for missing/competing tokens.**
- [ ] **Step 3: Consolidate duplicate theme selectors and update page-specific raw colours to semantic variables.**
- [ ] **Step 4: Add visible focus, selected, disabled, error, and input states for both themes.**
- [ ] **Step 5: Run theme tests and commit `style: unify premium application theme`.**

### Task 6: End-to-end verification and staged release

**Files:**
- Modify: `tests/e2e/helpers.ts` only if required by an actual failing test; preserve its existing line-ending-only change.
- Create: `tests/e2e/call-centre.spec.ts`

- [ ] **Step 1: Add browser coverage for `/calls`, quick lead capture, Timely checkbox, search, and theme toggle.**
- [ ] **Step 2: Run the browser test against the local Vite app and fix only call-centre regressions.**
- [ ] **Step 3: Run `npm run build`, `npm run lint`, and `npm test -- --run`.**
- [ ] **Step 4: Deploy a Vercel preview and verify `/calls`, `/map`, light theme, dark theme, CSV import, and Google-authenticated navigation.**
- [ ] **Step 5: Promote the verified preview to production and record the deployment URL.**
- [ ] **Step 6: Commit `test: verify call centre workflow` if test files changed.**

