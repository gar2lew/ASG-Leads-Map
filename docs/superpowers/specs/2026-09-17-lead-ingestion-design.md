# Dual-Source Lead Ingestion Design

## Goal

Allow leads to be created directly in the app while retaining Jotform import, with both sources using the same validation, geocoding, deduplication, and persistence rules.

## Scope

This change adds a dedicated in-app Add Lead workflow and formalizes Jotform as a second ingestion source. The existing Add Pin workflow remains field-activity oriented and is not repurposed.

## Data model

Extend `Pin` with optional source metadata to preserve existing stored records:

- `source?: 'manual' | 'jotform'`
- `externalId?: string`

New manual leads use `outcome: PinOutcome.Lead`, `source: 'manual'`, and the signed-in user as `createdBy`. Jotform records use `source: 'jotform'` and the Jotform submission identifier when available.

## Shared ingestion contract

Add a domain-level ingestion service with a source-neutral input:

```ts
interface LeadIngestionInput {
  address: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  notes?: string
  officeId: OfficeId
  source: 'manual' | 'jotform'
  externalId?: string
}
```

The service will:

1. Normalize contact and address fields.
2. Reject records without an address or usable contact detail.
3. Reuse the existing address geocoder.
4. Detect duplicates using the existing lead-import dedupe rules, plus `source + externalId` when present.
5. Create and persist a lead pin through the existing storage adapter.
6. Return a typed result distinguishing created, duplicate, invalid, and geocoding-failed records.

## User flows

### Manual Add Lead

Add a dedicated Add Lead action for users who can create pins. The form requires address, office, and at least one contact field. On success it confirms the created lead and keeps the user on the current page.

### Jotform import

Keep the current spreadsheet import available, but route accepted records through the shared ingestion service. Existing preview, duplicate counts, progress, and error reporting remain intact.

The webhook/API adapter is outside this first implementation slice; the contract will make it possible to add later without changing the manual flow.

## Reporting and display

Lead detail and reporting exports may display the source label. Existing records without metadata display `Unknown` and remain fully usable.

## Error handling

- Validation errors are shown beside the relevant form field or import row.
- Duplicate leads are reported without creating a second pin.
- Geocoding failures do not create partial records.
- Persistence failures leave the existing offline queue behaviour intact.

## Testing

Add tests for:

- manual lead input validation
- source metadata creation
- duplicate detection by external ID
- shared ingestion success and failure results
- manual form submission
- existing Jotform import regression behaviour

## Non-goals

- Replacing the existing Add Pin field workflow
- Building a live Jotform webhook endpoint in this slice
- Introducing a separate Lead database collection
- Changing territory assignment behaviour
