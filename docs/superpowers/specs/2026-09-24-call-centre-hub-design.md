# Call Centre Hub and Timely CRM Handoff

## Purpose

Turn `/calls` into the operational hub for Perth and Brisbane lead intake, phone calls, door-knocking results, qualification, callbacks, and the final handoff into Timely CRM. The app remains the working register; Timely CRM handoff is an explicit checkbox/trigger rather than an automatic integration.

## Success criteria

- A rep can create or update a lead quickly from mobile or desktop.
- Calls and door knocks are recorded as repeatable activities against one lead.
- The register clearly shows what is new, due for follow-up, qualified, archived, or already sent to Timely CRM.
- Existing CSV imports and local browser data continue to work.
- The same visual system is readable in light and dark themes and matches the Stitch field-register direction.
- A lead can be marked `Sent to Timely CRM` with the acting user and timestamp; unchecking is allowed only through an explicit confirmation.

## Scope

### In scope

- Responsive call-centre workspace at `/calls`.
- Lead register with card view on narrow screens and table view on larger screens.
- Lead intake form, phone-call activity form, door-knock activity form, follow-up date, notes, rep, office, and qualification fields.
- Search, status/outcome filters, rep/office filters, callback-due filter, and CRM-handoff filter.
- Timely CRM handoff checkbox/trigger with `timelySynced`, `timelySyncedAt`, and `timelySyncedBy` fields.
- CSV import/export compatibility with existing spreadsheet headers.
- Theme token cleanup for page surfaces, inputs, labels, muted copy, selected controls, and navigation.
- Repository boundary preserving current local-storage behaviour while allowing Firebase persistence later.

### Out of scope

- Direct Timely CRM API integration.
- Automated CRM submission or background sync.
- Replacing the existing map, authentication, or Firebase security model.
- Reworking unrelated administration screens beyond shared theme tokens.

## Domain model

The existing lead row remains the compatibility boundary. It gains optional fields rather than changing existing CSV meanings:

```ts
type LeadRecord = ExistingLeadRow & {
  office?: 'perth' | 'brisbane'
  qualification?: 'new' | 'qualified' | 'callback' | 'not_interested' | 'archived'
  followUpDate?: string
  lastActivityAt?: string
  timelySynced?: boolean
  timelySyncedAt?: string
  timelySyncedBy?: string
}

type LeadActivity = {
  id: string
  leadId: string
  kind: 'call' | 'door_knock'
  occurredAt: string
  repName: string
  outcome: string
  notes: string
  followUpDate?: string
}
```

Activities are append-only in the UI. Editing a lead updates the current lead snapshot; adding a call or knock creates a new activity and updates `lastActivityAt`.

## User experience

The page is organised into four zones:

1. **Command bar** — page title, office selector, search, import, export, and primary quick actions.
2. **Pipeline summary** — compact cards for new leads, calls today, callbacks due, door knocks, qualified, and Timely-ready totals.
3. **Quick capture panel** — collapsible `Add lead`, `Log call`, and `Log door knock` modes. The form prioritises address/name/contact, outcome, notes, follow-up, qualification, and the Timely checkbox.
4. **Lead register** — cards on mobile, dense table on desktop. Each row exposes outcome, next action, latest activity, rep, and Timely status without opening a detail page.

The mobile layout follows the supplied Stitch renders: sticky compact header, stacked capture card, lead cards with clear outcome chips, and a bottom navigation/action area. Desktop keeps the current navigation but uses the same cards, tokens, and hierarchy.

## Data flow and persistence

- `leadRegisterRepository` owns load, save, import, export, and activity operations.
- The initial implementation adapts the existing local-storage repository, preserving current records and CSV behaviour.
- Repository methods return typed records and never expose storage details to components.
- Timely handoff is a local state transition only; it records who checked it and when.
- Future Firebase persistence can implement the same repository interface without changing the call-centre UI.

## Theme system

- Define one semantic palette for canvas, surface, raised surface, border, primary text, secondary text, muted text, placeholder, accent, success, warning, and danger.
- Light and dark themes must provide every semantic token; no page may use raw near-black text on a dark surface or near-white text on a light surface.
- Form controls, selected chips, disabled states, errors, and focus rings receive explicit contrast-safe styles.
- Remove page-specific overrides that compete with the global theme selectors.

## Error handling

- Invalid or incomplete capture shows field-level validation and preserves entered values.
- CSV rows with missing required identity fields are skipped with an import summary.
- Timely uncheck requires confirmation and records no false sync state.
- Storage failures show a recoverable banner and keep the form draft in memory.

## Testing and rollout

- Unit tests for record migration, activity append/update, filters, Timely handoff state, and CSV round trips.
- Component tests for quick capture, mobile card actions, desktop table filters, and validation.
- Build, lint, and full Vitest run before deployment.
- Deploy to a Vercel preview, verify `/calls` and `/map` in both themes, then promote production.

