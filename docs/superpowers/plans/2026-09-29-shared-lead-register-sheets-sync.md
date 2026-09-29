# Shared Lead Register and Sheets Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Firestore the shared operational lead source for import, contact management, and map workspaces, with safe migration and inbound nightly Google Sheets reconciliation.

**Architecture:** Reuse the office-scoped `leads` collection and a typed browser repository; keep the existing read-only Sheets API/service-account integration server-side. A once-nightly protected Vercel Cron and an authenticated manual sync invoke the same idempotent reconciliation path; app-only activity and Timely CRM fields remain Firestore-owned.

**Tech Stack:** React 19, TypeScript 6, Firebase client SDK and Firestore, Firebase Admin SDK in Vercel Functions, Vite, Vitest, Firestore rules tests.

**Spec:** `docs/superpowers/specs/2026-09-29-multi-workspace-app-design.md`

## Global Constraints

- Google Sheets credentials stay server-side and read-only.
- Firestore is the shared operational source of truth; app edits are not written back to Sheets.
- Lead reads and writes remain scoped to the signed-in user's office and role.
- Browser clients may edit operational lead fields but cannot create or modify Sheets source snapshots, conflicts, or sync audit metadata; only the server-side Admin sync path may do so.
- Never delete Firestore records because a source row disappears; migration is idempotent and preserves old data until verified.
- Preserve Australian date/phone formatting, existing deep links, CSV export, Timely handoff state, and offline map activity.
- Keep the existing Vercel function budget in mind; prefer extending `api/leads/index.ts` rather than adding another function unless deployment limits are verified.
- Run a once-nightly scheduled refresh plus manual **Sync now**; show sync freshness/status to authorised users.

## Review Focus

- Same `LeadID` in Perth and Brisbane must remain two office-specific leads; cover in `src/domain/leadRegisterRepository.test.ts`.
- Concurrent source and app edits to one mapped field must preserve Firestore and create a reviewable conflict; cover in `src/integrations/leads.test.ts`.
- Missing or malformed sheet fields must not erase valid Firestore values; cover in `src/integrations/leads.test.ts`.
- Repeated baseline/migration must not duplicate records or activities; cover in repository and migration tests.
- Unauthorised or wrong-office clients must not read/write leads; cover in Firestore rules emulator tests.

---

### Task 1: Define canonical shared lead identity and source projection

**Files:**
- Modify: `src/domain/leadRegister.ts`
- Test: `src/domain/leadRegister.test.ts`
- Modify: `src/domain/leadIngestion.ts`
- Test: `src/domain/leadIngestion.test.ts`

**Interfaces:**
- Produce `LeadRecord.source` with spreadsheet ID, tab name, source row, source `LeadID`, and last-seen timestamp; produce field-level source snapshot and conflict metadata types.
- Preserve existing `LeadRecord` properties and migration behavior for local-storage/CSV records.

- [ ] Add tests for office + `LeadID` identity, normalized office/address/name fallback, separate source snapshot, and preserving activity/Timely metadata during source merge.
- [ ] Run `npm test -- src/domain/leadRegister.test.ts src/domain/leadIngestion.test.ts`; confirm the new cases fail before implementation.
- [ ] Implement the minimal typed identity and source-projection helpers without changing existing CSV columns.
- [ ] Run the same targeted tests; expect PASS.
- [ ] Commit as `feat: define shared lead source identity`.

### Task 2: Add Firestore-backed lead repository

**Files:**
- Create: `src/domain/firestoreLeadRegisterRepository.ts`
- Test: `src/domain/firestoreLeadRegisterRepository.test.ts`
- Modify: `src/domain/leadRegisterRepository.ts`
- Test: `src/domain/leadRegisterRepository.test.ts`

**Interfaces:**
- Export `createFirestoreLeadRegisterRepository(db, user)` implementing `loadLeadRecords(): Promise<LeadRecord[]>`, `subscribeLeadRecords(onRecords, onError): Unsubscribe`, `saveLeadRecord(record): Promise<LeadRecord>`, `addLeadActivity(recordId, activity): Promise<void>`, and `setTimelyHandoff(recordId, sent, user, timestamp?): Promise<void>`.
- `saveLeadRecord` preserves existing `source` metadata; browser callers cannot create or edit source snapshots/conflicts. Sheets source upserts and reconciliation counts belong to the server-side API in Task 5.
- Keep `createLeadRegisterRepository(storage?)` available for explicit legacy migration and existing tests; page code must use the signed-in Firestore repository after cutover.

  - [x] Test subscriptions, office filtering, activity append, Timely state retention, source metadata preservation, and client rejection of source-field writes using repository tests.
  - [x] Run targeted repository tests and confirm the new cases fail before implementation.
  - [x] Implement the repository using Firestore `query`/`onSnapshot`/merge-only `setDoc` plus atomic `arrayUnion` activity append; do not expose Admin credentials to browser code.
  - [x] Run targeted tests; expect PASS and no regressions in `leadRegisterRepository.test.ts`.
  - [x] Commit as `feat: add shared Firestore lead repository` (review fix committed separately).

### Task 3: Tighten Firestore rules and indexes for shared records

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`
- Test: existing Firestore rules test files (locate with `Get-ChildItem -Recurse -Filter '*rules*test*'` before editing; add `tests/firestore/leads.rules.test.ts` if none exist).

**Interfaces:**
- Use the canonical `leads/{leadId}` document with required `officeId` and immutable office identity on update; deny client creation or modification of source metadata.
- Preserve the server-only Admin sync path, which bypasses client security rules; do not add browser write privileges for sync metadata outside the user's office.

  - [x] Add emulator tests for signed-out, inactive, same-office, cross-office, and super-admin read/write behavior plus officeId mutation and source metadata rejection.
  - [x] Run the rules-emulator command; confirmed source metadata creation failed against the original rules.
  - [x] Implement least-privilege create/read/update rules; no composite indexes are required for current office-only equality queries.
  - [x] Run rules tests and TypeScript/build checks; expect PASS.
  - [x] Commit as `fix: scope shared leads by active user office` after focused security review.

### Task 4: Build safe legacy migration preview and execution

**Files:**
- Create: `src/domain/leadRegisterMigration.ts`
- Test: `src/domain/leadRegisterMigration.test.ts`
- `src/domain/pinStorage.ts` is consumed through its existing `getAllPins()` merge of remote pins and offline IndexedDB queue; no changes are needed here for the pure migration service.

**Interfaces:**
- Export `previewLegacyLeadMigration({ browserRecords, firestorePins, firestoreLeads }): MigrationPreview` and `migrateLegacyLeadRecords(preview, repository): Promise<MigrationResult>`.
- `MigrationPreview` identifies matched, new, duplicate, conflicting, and unmapped records; migration never clears localStorage or IndexedDB.

- [x] Test repeat execution, duplicate matches, unmatched pins, preservation of activity/CRM fields, and no local deletion.
- [x] Run targeted migration tests; confirm failure before implementation.
- [x] Implement a preview-first, idempotent migration preserving source IDs where possible; map geocoded pins to the same lead record and retain offline queue behavior.
- [x] Run migration tests; expect PASS. Pin-storage behavior remains unchanged and existing `getAllPins()` includes the offline queue.
- [x] Commit as `feat: add previewed legacy lead migration`.

### Task 5: Implement deterministic Sheets reconciliation

**Files:**
- Modify: `src/integrations/leads.ts`
- Test: `src/integrations/leads.test.ts`
- Modify: `api/leads/index.ts`
- Test: `api/leads/index.test.ts`
- Modify: `vercel.json`

**Interfaces:**
- Export a pure `reconcileSheetRows({ rows, priorSnapshot, currentRecords, source }): ReconciliationPreview` returning inserts, non-conflicting updates, unchanged rows, invalid rows, duplicates, and field conflicts.
- The existing `/api/leads` function accepts authenticated manual-sync requests and a scheduled request authenticated by `Authorization: Bearer ${CRON_SECRET}`; both call the same reconciliation service and return the summary plus conflict details. Keep the Vercel function count at or below the current 12 by extending this function rather than adding one.
- Cron must be once nightly, idempotent, and read-only to Sheets. Do not write inbound rows to Firestore until the baseline is explicitly confirmed.

- [ ] Test six source tabs for Perth and Brisbane, baseline preview/confirmation, duplicate suppression, row deletion, invalid/missing fields, concurrent app edits, cron auth, and manual user auth.
- [ ] Run targeted integration/API tests; confirm failure before implementation.
- [ ] Implement shared reconciliation and server-side Admin writes; keep credentials and conflict resolution server-protected and never overwrite activities, notes, qualification, Timely handoff, or audit fields.
- [ ] Configure `0 15 * * *` in `vercel.json` targeting `/api/leads` (11:00 p.m. Perth time); verify it matches Vercel Hobby's once-per-day limit and protect the handler with `CRON_SECRET`.
- [ ] Run tests and production build; expect PASS.
- [ ] Commit as `feat: reconcile nightly Sheets leads into Firestore`.

### Task 6: Add import baseline, manual sync, and conflict review UI

**Files:**
- Modify: `src/pages/LeadImportPage.tsx`
- Test: `src/pages/LeadImportPage.test.tsx`
- Modify: `src/integrations/leads.ts` (client API adapter)
- Test: `src/integrations/leads.test.ts`

**Interfaces:**
- Add `previewBaseline(office)`, `confirmBaseline(previewId)`, and `syncNow(office)` client methods returning typed summaries.
- Display last sync time/status, source office/workbook, new/matched/skipped counts, and per-field conflicts with explicit keep-Firestore/use-Sheets resolution.

- [ ] Add UI tests for preview before write, explicit confirmation, manual refresh, conflict resolution, and retry with draft retained.
- [ ] Run the page tests; confirm new cases fail before implementation.
- [ ] Implement the dedicated import workflow; retain current workbook/CSV import and permissions.
- [ ] Run import page and integration tests; expect PASS.
- [ ] Commit as `feat: add Sheets baseline and sync review UI`.

### Task 7: Cut map and contact management over to shared leads

**Files:**
- Modify: `src/pages/CallLogPage.tsx`
- Test: `src/pages/CallLogPage.test.tsx`
- Modify: `src/pages/MapPage.tsx`
- Test: `src/pages/MapPage.test.tsx`
- Modify: `src/domain/pinStorage.ts`
- Test: `src/domain/leadRegisterRepository.test.ts`

**Interfaces:**
- Both pages consume the same Firestore lead repository and realtime subscription.
- Map view projects records with valid coordinates to existing map pins; records without coordinates remain in the contact/import register with an explicit geocode/review state.
- Preserve the existing map pin offline queue and `/map`, `/calls`, `/admin/import` URLs.

- [ ] Add cross-view tests showing one imported lead and subsequent activity/Timely/map updates reflected by the relevant views, plus non-geocoded lead retention and offline recovery.
- [ ] Run page/repository tests; confirm new cases fail before implementation.
- [ ] Cut over page reads/writes and pin projection; keep the migration source available until post-deploy sample/count verification.
- [ ] Run page tests and `npm run build`; expect PASS.
- [ ] Commit as `feat: share leads across map and contact workspaces`.

### Task 8: Validate sync and migration end-to-end

**Files:**
- Modify: `.env.example` (document names only; no values)
- Modify: `README.md` or existing deployment runbook
- Test: relevant Firestore emulator and Playwright end-to-end tests

**Interfaces:**
- Document `CRON_SECRET` and existing Sheets/Firebase Admin variables, scheduled route, once-nightly schedule, manual refresh, backup, and baseline confirmation procedure.
- Preserve Vercel Hobby compatibility: schedule once daily in UTC and communicate that execution may be delayed within Vercel's documented window.

- [ ] Add an end-to-end test that baseline preview does not write, confirmation writes one record per unique office/source identity, repeat sync is idempotent, cross-office data stays separated, and one app-only edit produces a visible conflict rather than being overwritten.
- [ ] Run `npm test -- src/domain/leadRegister.test.ts src/domain/leadRegisterRepository.test.ts src/domain/leadRegisterMigration.test.ts src/integrations/leads.test.ts src/pages/CallLogPage.test.tsx src/pages/LeadImportPage.test.tsx src/pages/MapPage.test.tsx`.
- [ ] Run `npm run lint`, `npm run build`, and the documented Firestore rules emulator suite; all must pass before deployment.
- [ ] Deploy a Vercel Preview; manually verify counts and sample records against both Sheets before enabling the nightly production cron in Production.
- [ ] Commit as `docs: document shared lead sync operations`.
