# ASG Role-Focused Workspace Experience Design

**Date:** 30 September 2026
**Status:** Approved in conversation; awaiting written-spec review

## Intent

Elevate the signed-in product from a generic admin-style SaaS shell into two clearly purposeful daily workspaces:

1. **Field Map** for representatives capturing and updating door-knock activity at properties.
2. **Call Centre** for callers processing, qualifying, and following up leads before the explicit Timely CRM handoff.

The workspaces should feel like related parts of one ASG product, not one screen forced to serve both jobs. Authentication, permissions, Firestore lead records, map pins, Google Sheets ingestion, activity history, and Timely handoff semantics remain shared and compatible.

## Product evidence and design rationale

- Field-sales products such as SPOTIO foreground territory coverage, mapped prospects, field activity, and route context.
- SalesRabbit documents a map-led mobile workflow: place a lead pin, open its detail panel, then update status and notes.
- HubSpot’s sales workspace groups prioritized prospecting actions into a queue with the contact context and follow-up actions available while working.
- The current ASG app already contains the essential capabilities, but presents them with a shared navigation full of workspace and administration links, a large capture form, equal-weight metric tiles, and a generic lead-card queue. This makes both jobs feel like one admin page rather than focused daily tools.
- The theme stylesheet contains overlapping legacy/semantic tokens and selectors whose text values are tied to “on-light” names inside dark mode. This makes visual correctness dependent on selector order and system color preference rather than a single reliable theme definition.

These products are workflow references only. ASG will use its own information architecture, visual language, terminology, and component composition; no competitor screen will be copied pixel-for-pixel.

## Recommended architecture

Keep one React application, authentication model, shared lead data model, and deployment. Give the Map and Call Centre distinct page shells and navigation emphasis, while retaining a shared ASG identity and fast workspace switcher. Keep import, reporting, territory, and user administration in a quieter operations/admin navigation group rather than presenting every route as a peer of the daily workspaces.

The first design pass is a presentation and interaction-hierarchy change. Do not introduce a new CRM, telephony provider, lead schema, Firestore collection, or import/sync behavior. Reuse existing route capabilities and domain actions; retain existing URLs and deep links.

## Workspace experience

### Field Map

- Make the map the dominant, full-viewport work surface, especially at field/mobile widths.
- Keep territory/office, search, status filters, sync state, and add-pin/add-lead actions compact and immediately reachable.
- Selecting a lead opens a focused property panel with address, contact, qualification, latest activity, and fast outcomes (knocked, no answer/not knocked, callback/lead, not interested, not qualified as supported by the existing model).
- Save a door-knock result with minimal navigation; expose full details only when needed.
- Preserve map pins, deep linking from a lead, GPS/location behavior, offline persistence and retry, and current export permissions.
- On small screens, use a compact map header, bottom property/action sheet, and touch-sized controls rather than shrinking desktop navigation.

### Call Centre

- Treat `/calls` as an inside-sales work queue, not a dashboard plus a large always-open entry form.
- Put the next useful work first: callbacks due, new/unworked leads, recent activity, and explicit Timely state. Counts should be compact, useful, and clickable filters rather than six competing KPI cards.
- Use a queue/list beside a focused lead workspace on desktop. The focused workspace should show contact/address context, qualification, activity timeline, call actions, outcome capture, notes, follow-up scheduling, map handoff, and Timely marker without losing the queue position.
- On mobile, turn this into a single-lead-at-a-time flow with clear previous/next queue controls and one-thumb outcome actions.
- Make Add Lead / Log Call / Log Door Knock available as intentional quick actions. Keep the form focused on the active task and preserve existing validation, local drafts, CSV compatibility, Google Sheets refresh entry points, and Firestore operations.
- Use address-to-map navigation to verify property location without changing the caller’s queue context when returning.

## Shared design system and navigation

- Keep the ASG navy/gold brand identity but use gold as a restrained action/selection accent, not as a substitute for text contrast. Use quiet warm-neutral light surfaces and a softer navy/graphite dark palette.
- Use a consistent modern sans-serif for app UI, forms, data, and headings. Keep any display/brand typography isolated to the brand mark if retained; avoid a serif-heavy admin-template impression.
- Consolidate theme styling around semantic tokens: canvas, surface, raised surface, border, primary/secondary/muted text, placeholder, focus, action, and status. Each supported theme defines every token independently; components must not infer text color from light-mode aliases or OS preference.
- Keep standard light and dark modes readable by default. If high-contrast mode remains, treat it as an explicit accessibility mode with deliberate colors rather than the default “dark” aesthetic.
- Keep shared controls consistent (focus, input, selected/disabled/error states, badges, dialogs) while allowing different density and composition in each workspace.
- The global header should contain brand, current workspace/switcher, only the relevant workspace links, and a compact account/menu area. Put administration routes under a secondary menu/section.

## Data, access, and compatibility constraints

- Continue to use current Firebase Auth and existing capability/office checks; visual navigation never grants access.
- Continue to use the shared Firestore lead/activity records so a call outcome and map outcome remain visible across workspaces.
- Keep map-only offline pin/activity retry behavior and the durable retry key/id semantics.
- Google Sheets remain an inbound baseline/refresh source, not a write-back destination.
- Timely CRM remains a manually confirmed handoff marker; do not imply that checking the marker submits a record to Timely.
- Preserve Perth/Brisbane distinctions, Australian phone/date formats, keyboard access, and deep-linked lead navigation.

## Scope boundaries

**Included:** workspace-specific visual hierarchy; shared navigation cleanup; semantic theme-token correction; responsive Map and Call Centre compositions; small interaction changes needed to make existing actions faster and clearer; corresponding component/accessibility tests.

**Not included:** changing authentication, permissions, Firestore schema/rules, Sheets sync, lead deduplication, Timely integration, adding predictive scoring/AI, actual telephony/call recording, route optimization, a new application deployment, or a full rewrite of Import/Admin. Those require separate design decisions if later desired.

## Acceptance criteria

1. A field representative can locate an existing lead, record a door-knock outcome, and add a new pin/lead from the map without first navigating through the Call Centre.
2. A caller can select the next due/unworked lead, call or log an activity, schedule a follow-up, and move to the next lead without losing queue filters or position.
3. A lead opened from either workspace shows consistent current details and activity; map navigation returns to the relevant lead.
4. Timely handoff remains an explicit, accurately labelled state change and never claims an API transfer occurred.
5. Existing users, deep links, exports, Sheets sync controls, and office/capability protections continue to behave as before.
6. Light and dark themes have readable labels, values, placeholders, and selected states on every redesigned view regardless of OS preference; keyboard focus is visible.
7. Desktop and mobile layouts are deliberately composed for each job, with no horizontal page overflow at tested widths.
8. The product build, lint, unit/component tests, and route/role/accessibility smoke checks pass before preview review.

## Delivery sequence

1. Establish and test the semantic token mapping and shared-shell navigation contract.
2. Refine the Map workspace around map selection, property details, quick outcomes, and responsive field use.
3. Refine the Call Centre around queue-first execution, lead context, timeline, and fast capture.
4. Run regression, accessibility, theme, role, route/deep-link, and responsive checks; review both workspaces together in a preview before any production release.
