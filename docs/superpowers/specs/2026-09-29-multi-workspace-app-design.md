# ASG Multi-Workspace and Shared Lead Register Design

**Date:** 29 September 2026
**Status:** Draft for user review

## Goal

Make the app feel like three focused products for three related jobs, while retaining one sign-in, one shared Firestore lead register, and shared permissions:

1. **Leads Map** — territory and field activity.
2. **Leads Import** — bring external registers and files into the appropriate ASG workflows, with review and duplicate checks.
3. **Lead Contact Management** — qualify and follow up leads, log calls and door knocks, and mark when a lead has been entered into Timely CRM.

After signing in without a deep link, users choose a workspace. Within a workspace, its dashboard and navigation prioritise that job. Users can switch workspaces without signing in again. Google Sheets provide the initial baseline and an inbound refresh feed; Firestore becomes the shared operational source of truth for all three workspaces.

## Current application context

- The app is a single React application with React Router and one authenticated `Layout` shell.
- `/map`, `/dashboard`, and `/calls` are authenticated routes.
- `/admin/import` is an existing workbook-to-map import route guarded by the current `users:manage` capability.
- `/calls` currently combines the call/contact register, fast lead capture, and live Perth/Brisbane Google Sheets imports.
- Contact-register rows currently use browser `localStorage` under `asg-call-log`, so they are per-browser and not shared with other users/devices.
- Map pins currently use an IndexedDB offline queue with a Firestore `pins` collection path for configured signed-in users. Pins and contact rows are not currently one shared lead record.
- Authentication, Firestore user roles, the read-only Sheets API integration, and Timely CRM handoff marker are already deployed and are to be preserved.

## Architecture options

### A. One app with distinct workspaces — recommended

Add a workspace chooser and workspace-specific shells/navigation over the existing routes and services. Keep one identity and establish a canonical, office-scoped Firestore lead record used by all workspaces. Preserve explicit domain/repository boundaries for map, import, and contact workflows while migrating existing records safely.

**Advantages:** lowest operational overhead, immediate workspace switching, no duplicated authentication or secrets, and shared lead updates flow to every module.
**Trade-offs:** the app remains one deployment, so route/component boundaries and the shared lead repository must stay clear; existing browser-local contacts and map pins require a staged migration.

### B. Three separately deployed apps

Split map, import, and contact management into separate frontends with shared Firebase services.

**Advantages:** maximum release and interface isolation.
**Trade-offs:** duplicated deployment configuration, more cross-app navigation/auth edge cases, and greater risk of inconsistent shared data behavior. This is not warranted while the modules share users, registers, and workflows.

### C. One app with only role-based landing pages

Keep one shell and send each role to a different default route.

**Advantages:** minimal initial implementation.
**Trade-offs:** roles do not necessarily correspond to the user's task; the functions would still be blended in the same navigation and users could not intentionally choose their workspace. This does not meet the requested experience.

The approved direction is Option A, with Firestore as the shared operational record store and Sheets as an inbound source.

## Workspace navigation and routing

- Add an authenticated workspace-selection page, proposed route `/workspaces`.
- After sign-in with no explicit deep link, route to `/workspaces` instead of silently opening `/map`.
- Preserve an explicitly requested deep link through sign-in; do not interrupt a user who opened a shared or bookmarked route.
- Add a persistent workspace switcher to the authenticated header. It returns to `/workspaces` and shows only workspaces the user is authorised to open.
- Give each workspace its own navigation group and landing dashboard; use clear workspace identity and a consistent shared ASG visual system.
- Preserve existing URLs as compatible entry points: `/map`, `/admin/import`, and `/calls` continue to open the corresponding workspace. New canonical aliases may be added without breaking bookmarks.
- Provide a clear way back to workspace selection from every workspace.

## Workspace responsibilities

### Leads Map

- Own map pins, territories, field search, outcomes, and map-oriented reporting.
- Its landing page remains the operational map, with a focused map/field dashboard rather than contact-register capture controls.
- Read map-ready leads from the shared Firestore register. A lead with a valid address but no coordinates remains available in the register and is marked for geocoding/review; it is not silently dropped.
- Preserve offline field activity by retaining an IndexedDB queue that safely syncs to the canonical Firestore lead record.

### Leads Import

- Own external lead intake: supported workbook/CSV upload, initial Google Sheets baseline sync, scheduled and manual refresh, preview, validation, duplicate review, progress, and results.
- Make import source, office, destination, and duplicate/skip counts explicit before confirming writes.
- Write accepted records to the canonical Firestore lead register; the Contact Management workspace can qualify them and the Map workspace can display those with usable coordinates.
- Keep current import route and permission behavior unless a later, separately approved role change is needed.

### Lead Contact Management

- Own the pre-Timely lead/contact register, call and door-knock activities, callbacks, qualification, notes, and the explicit “Sent to Timely CRM” marker.
- Provide an at-a-glance queue for new leads, today's activity, callbacks due, field activity, qualified leads, and Timely-ready/sent records.
- Keep a compact source freshness indicator and a link to refresh/open the source in the dedicated Leads Import workspace; do not duplicate bulk import controls here.
- Preserve current lead/activity records, CSV export, Australian date and phone formatting, and the Timely handoff metadata.

## Shared identity, data, and access

- Continue using the existing Firebase authentication and Firestore user profile/role as the identity and access source of truth.
- Introduce one canonical Firestore lead record, keyed/upserted by office plus source `LeadID`; when an ID is unavailable, use normalized office + address + lead name as a fallback match.
- The canonical record includes office, name/address/contact, source identity, qualification/follow-up, Timely handoff state, and optional geolocation/map outcome. Store repeatable call/door-knock activities as append-only activity records associated with the lead so a sheet refresh cannot erase history.
- All three workspaces read/write the same canonical lead records. Use Firestore realtime listeners so changes made in one workspace appear in the others without re-importing.
- Keep repeatable calls/door-knocks as append-only activities associated with the canonical lead. Preserve Timely handoff metadata and map outcome/geolocation as fields on that shared record.
- Do not create separate Firebase projects, user accounts, or duplicate lead records for the workspaces.
- Workspace visibility and route access must use existing capability checks. The workspace chooser must not reveal or grant a workspace merely because a user knows its URL.
- Keep Google Sheets credentials server-side and read-only. Google Sheets is an inbound source; neither scheduled sync nor app edits write back to the spreadsheets.
- Run an initial baseline sync with a preview and explicit confirmation. Follow it with an automatic scheduled refresh and a manual **Sync now** action. The refresh must be idempotent, retain source row/tab metadata, and never delete Firestore records because a row disappears from Sheets.
- The configured Perth and Brisbane workbooks and their lead-status tabs are inbound sources. Initial preview reports new records, matched updates, duplicates, invalid/skipped rows, and existing local data before any baseline write is confirmed.
- Store the last-imported spreadsheet snapshot for each mapped source field. When a sheet field changes, update Firestore only if that field has not also changed in Firestore since the prior sync. If both sides changed the same field, preserve the Firestore value and surface a reviewable conflict instead of overwriting either value silently.
- Source refreshes may update mapped spreadsheet fields such as contact details and the current spreadsheet status/result projection. App-owned activity history, app-authored notes/qualification decisions, CRM handoff state, and audit metadata must never be overwritten by a sheet refresh.
- App-created leads and all workspace edits write directly to Firestore. They do not create or edit source-sheet rows.
- Migrate existing Firestore `pins` records and browser-local call-register records idempotently into the canonical collection. Preserve existing IDs where possible, map duplicate records by office/LeadID or normalized address/name, retain activity and CRM metadata, report unmatched/conflicting records, and keep old data intact until migrated counts and sample records are verified.
- Each browser with locally saved call-register records must be offered a previewed migration; local data is not cleared automatically. Existing unsynced IndexedDB pins remain available offline and sync to their canonical records when authorised connectivity returns.
- Firestore security rules scope lead reads/writes to the signed-in user's office and role. Background Sheets sync uses a server-only credential with read-only spreadsheet scope and a separately protected trigger; no service credential is exposed to the browser.

## Shared visual system

- Carry the approved ASG navy, warm ivory, and restrained gold design tokens through all workspace shells.
- Each workspace may have distinct information hierarchy and navigation, but controls, status colors, typography, focus states, and contrast rules remain consistent.
- Maintain readable labels, input text, placeholders, errors, and selected states in both themes; preserve keyboard and touch accessibility.
- Responsive layouts must remain purpose-built: map-first for field use, guided preview for importing, and queue/form density for contact management.

## Error, loading, and recovery behavior

- Show a workspace loading state while authentication and profile capabilities resolve; do not briefly display restricted module cards.
- If a deep-linked workspace is no longer authorised, explain that access changed and return the user to an authorised workspace.
- Import/sync failures preserve the current preview/draft, prior Firestore records, and local migration source data; report actionable errors and allow retry.
- Conflicting edits are visible in an admin review queue with source, field, last sheet value, current Firestore value, and resolution action. A failed/conflicted sync must not roll back unrelated fields or activities.
- Switching workspaces must not discard an unsaved form or import preview silently; warn or retain the draft according to the existing page behavior.

## Success criteria

- A user signing in normally sees a concise workspace chooser with Leads Map, Leads Import, and Lead Contact Management, limited to authorised workspaces.
- Selecting a workspace opens a distinct, task-focused landing dashboard and navigation.
- Users can switch workspaces without signing out; deep links and current URLs continue to work.
- Contact management, lead import, and map field activity show the same Firestore-backed lead record and current activity state, subject to office/role access.
- A successful baseline sync creates one Firestore record per unique source lead; repeat syncs update changed, non-conflicting source fields without duplicating records or overwriting app-only state.
- A manual refresh can be triggered and scheduled sync freshness/result is visible to authorised users.
- Existing map pins and browser-local call-register records remain recoverable until their migration is verified; roles and saved preferences remain intact.
- Both themes are legible, and the experience works at desktop and mobile widths.

## Non-goals

- Splitting this repository into three deployed applications.
- Replacing Firebase authentication or changing role assignments.
- Introducing a direct Timely CRM API integration or automatic CRM submission.
- Automatically writing app edits back to source Google Sheets.
- Writing app edits back to the source Sheets.
- Deleting or replacing existing map-pin or browser-local contact data before successful migration verification.
- Reworking unrelated admin/settings features.

## Delivery and verification

Implementation is staged so users retain access throughout the transition:

1. Add the Firestore repository/rules and idempotent migration path; verify migrated pins and local call-register samples without deleting old data.
2. Add the Sheets baseline/reconciliation service, protected scheduled refresh, manual refresh, and conflict review. Verify read-only Sheets access, repeat sync idempotence, and no-overwrite rules.
3. Move import, contact, and map views to the shared repository while preserving offline pin queuing and existing deep links.
4. Add the workspace chooser/switcher and distinct navigation/dashboards; verify role restrictions, both themes, and responsive behavior.

Each phase must be independently buildable and deployable; production migration requires a recoverable backup/export and an explicit verification gate before legacy data is retired.

Required verification includes Firestore rules/office scoping, migration dry runs and idempotence, Sheets initial and repeated sync, conflict/no-overwrite cases, route/capability and deep-link tests, workspace switching, cross-workspace realtime visibility, offline pin recovery, import duplicate cases, responsive smoke checks, both theme modes, production build, and a Vercel preview before production promotion.
