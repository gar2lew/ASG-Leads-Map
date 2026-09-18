# Dual-Source Lead Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual Add Lead workflow while routing manual and Jotform workbook records through a shared, deduplicating lead-ingestion service.

**Architecture:** Keep `Pin` as the persisted record and add optional source metadata for backward compatibility. A domain service will validate, geocode, deduplicate, create, and save lead pins; the manual form and existing import page will be thin adapters over that service.

**Tech Stack:** React 19, TypeScript, Vitest, IndexedDB/Firebase pin storage, existing Nominatim address search.

**Spec:** `docs/superpowers/specs/2026-09-17-lead-ingestion-design.md`

## Global Constraints

- Preserve the existing Add Pin field-activity workflow.
- Preserve existing Jotform workbook preview, progress, and duplicate behaviour.
- Do not add a separate Lead collection or external dependency.
- Do not create partial records when geocoding fails.
- New code must use TDD and existing repository conventions.

---

### Task 1: Extend Pin source metadata

**Files:**
- Modify: `src/domain/pin.ts`
- Modify: `src/domain/pinStorage.ts` only if storage serialization requires it
- Test: `src/domain/pin.test.ts` (create if absent)

**Interfaces:**
- `Pin.source?: 'manual' | 'jotform'`
- `Pin.externalId?: string`
- `CreatePinInput.source?: 'manual' | 'jotform'`
- `CreatePinInput.externalId?: string`

- [ ] **Step 1: Write a failing test** asserting `createPin` preserves `source` and `externalId`.
- [ ] **Step 2: Run `npm test -- --run src/domain/pin.test.ts` and confirm the new assertion fails.**
- [ ] **Step 3: Add the optional fields and copy them in `createPin`.**
- [ ] **Step 4: Run the focused test and confirm it passes.**
- [ ] **Step 5: Commit `feat: add lead source metadata to pins`.**

### Task 2: Build the shared ingestion service

**Files:**
- Create: `src/domain/leadIngestion.ts`
- Create: `src/domain/leadIngestion.test.ts`
- Modify: `src/domain/index.ts`

**Interfaces:**
- `LeadIngestionInput` as defined in the spec.
- `LeadIngestionResult` with `status: 'created' | 'duplicate' | 'invalid' | 'geocoding-failed'`, plus optional `pin`, `reason`, and `dedupeKey`.
- `ingestLead(input, userId, dependencies?)` returning `Promise<LeadIngestionResult>`.

- [ ] **Step 1: Write failing tests for missing address/contact, successful geocoding and save, duplicate address, and duplicate `source + externalId`.**
- [ ] **Step 2: Run `npm test -- --run src/domain/leadIngestion.test.ts` and confirm the new tests fail because the service is absent.**
- [ ] **Step 3: Implement dependency-injected geocoder, pin loader, and pin saver; use `normaliseLeadAddress`, `searchAddress`, `createPin`, and `savePin`.**
- [ ] **Step 4: Return typed results and ensure no save occurs for invalid, duplicate, or geocoding-failed inputs.**
- [ ] **Step 5: Run the focused tests and confirm they pass.**
- [ ] **Step 6: Commit `feat: add shared lead ingestion service`.**

### Task 3: Add the manual Add Lead form

**Files:**
- Create: `src/components/AddLeadModal.tsx`
- Create: `src/components/AddLeadModal.css`
- Create: `src/components/AddLeadModal.test.tsx`
- Modify: `src/pages/MapPage.tsx`

**Interfaces:**
- `AddLeadModal` accepts `isOpen`, `onClose`, `onCreated`, and `userId`.
- Form fields: address, contact name, contact phone, contact email, notes, office.

- [ ] **Step 1: Write failing component tests for required contact validation, successful submission, and error display.**
- [ ] **Step 2: Run the focused component test and confirm failure.**
- [ ] **Step 3: Implement the modal using `ingestLead({ source: 'manual' })`.**
- [ ] **Step 4: Add an Add Lead button beside Add Pin for users who can create pins.**
- [ ] **Step 5: Refresh the map pins after creation and show success/error feedback.**
- [ ] **Step 6: Run focused component tests and confirm pass.**
- [ ] **Step 7: Commit `feat: add manual lead entry form`.**

### Task 4: Route Jotform workbook records through ingestion

**Files:**
- Modify: `src/pages/LeadImportPage.tsx`
- Modify: `src/domain/leadImport.ts` only for external ID mapping if required
- Modify: `src/pages/LeadImportPage.test.tsx` (create if absent)

**Interfaces:**
- Existing `LeadImportPreview` remains unchanged for UI compatibility.
- Import calls `ingestLead({ source: 'jotform', externalId: record.leadId, ... })`.

- [ ] **Step 1: Write a failing regression test proving an imported record receives `source: 'jotform'` and its LeadID.**
- [ ] **Step 2: Run the focused test and confirm failure.**
- [ ] **Step 3: Replace direct `createPin`/`savePin` calls with `ingestLead`, preserving progress and skipped counts.**
- [ ] **Step 4: Keep the existing sheet/status note in the stored notes field.**
- [ ] **Step 5: Run import regression tests and confirm pass.**
- [ ] **Step 6: Commit `feat: route jotform imports through lead ingestion`.**

### Task 5: Verify the complete change

**Files:**
- Modify: none unless verification exposes a regression.

- [ ] **Step 1: Run `npx tsc -b --pretty false`.**
- [ ] **Step 2: Run `npm test` and confirm all tests pass.**
- [ ] **Step 3: Run `npm run lint` and classify warnings as new or pre-existing.**
- [ ] **Step 4: Run `npm run build` and record any bundle warnings.**
- [ ] **Step 5: Inspect `git diff` and confirm existing Phase A/B changes remain intact.**
- [ ] **Step 6: Commit `test: verify dual-source lead ingestion`.**
