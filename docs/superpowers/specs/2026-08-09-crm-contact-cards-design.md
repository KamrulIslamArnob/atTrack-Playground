# CRM contact popup + card view

Date: 2026-08-09

## Problem

CRM Contacts tab (`components/crm/crm-view.tsx`) adds contacts via an inline
form and lists them in a dense table. User wants: a popup to add/edit a
contact with more fields (position, LinkedIn, GitHub, a free-text tag instead
of the fixed role list), a card-based contact view instead of the table, the
ability to filter/sort by company and by tag, and `@`-mention support in the
notes field that links to a saved job.

## Data model

Add three columns to `contacts` (`lib/db/schema.sql`, plus an entry in
`COLUMN_MIGRATIONS` in `lib/db/sqlite.ts` so existing databases pick them up):

- `position TEXT` — the person's job title at their company. Distinct from
  the existing `role` column.
- `linkedin_url TEXT`
- `github_url TEXT`

`role` is **reused, not renamed**, as a free-text tag. `CONTACT_ROLES`
(`lib/types/contacts.ts`) stops being an enforced list and becomes seed
suggestions for a combobox — any string is a valid tag, and typing a new one
just works (no tags table; distinct tags are derived from `getContacts()`
results already in memory).

`notes` keeps its existing `TEXT` column. A job mention is embedded as
`@[Job Title](job:jobId)` inline in the text — no new table, no new column.

## Popup

New `components/ui/dialog.tsx`, added via the shadcn CLI (matches the repo's
documented convention — `components/ui/*` are shadcn-generated). Replaces the
inline `creating && (...)` create form in `crm-view.tsx`'s `ContactsView`.
`CompanyRow`'s `ContactsPanel` add-contact form is a separate, smaller
surface — see "Server actions touched" for how it's handled.

Fields, all in one `ContactFormDialog` used for both create and edit:

| Field | Required | Input |
|---|---|---|
| Name | yes | text |
| Email | no | email |
| Company | no | Select (existing companies list + "No company") |
| Position | no | text |
| Phone | no | text |
| Tag | no | combobox — `CONTACT_ROLES` labels + any tag already used by this user's contacts, free text accepted |
| LinkedIn | no | url |
| GitHub | no | url |
| Notes | no | Textarea with `@`-mention (see below) |

Only Name is required, matching the existing behavior (Email/Company are
already optional today).

## Card view

The Contacts tab's `<Table>` is replaced with a responsive card grid
(`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3` or similar). Each card
shows: initial-avatar circle, name, tag badge, company chip (with building
icon, same as today's Select-as-tag but now read-only text + an edit
affordance opens the popup), position, email, phone, LinkedIn/GitHub icon
links (only rendered when present), and a delete action. Clicking the card
(or an explicit edit icon) opens `ContactFormDialog` pre-filled, for editing.

The Companies tab's nested `ContactsPanel` (inside an already-expanded
`CompanyRow`) **keeps its current compact list layout** — it's a secondary,
already-nested surface; cards there would be too heavy. It still gains the
three new fields in its own create form and in `updateContact` calls, for
data consistency, but visually stays as-is.

## Filtering / sorting

The existing "All companies" `Select` in the Contacts tab toolbar stays. A
second `Select` is added next to it: **Tag**, with "All tags" plus every
distinct `role` value present across the user's contacts (case-sensitive
match, matching how tags are stored). Filtering combines both selects with
the existing search box, same AND semantics as today's company filter.

## `@`-mention in notes

- New action `getJobsForMention()` in `lib/actions/jobs.ts` (or a small new
  file) returning `{ id, title, company_name }[]` for the current user's
  jobs — reuses the existing `jobs` + `companies` join, no new query shape.
- The Notes `Textarea` in `ContactFormDialog` watches for `@` followed by
  characters; on `@` it opens a `Command`-based popover (existing
  `components/ui/command.tsx`) listing matching jobs. Picking one inserts
  `@[Job Title](job:jobId)` at the cursor.
- Wherever a note is rendered read-only (the contact card, if notes are
  shown there, and anywhere else notes surface), a small helper regexes
  `@\[([^\]]+)\]\(job:([^)]+)\)` into a `<Link href="/jobs/{id}">{title}</Link>`.
  Plain text elsewhere renders unchanged.

## Server actions touched

`lib/actions/contacts.ts`:
- `Contact` interface gains `position`, `linkedin_url`, `github_url`.
- `toContact()` / the `select()` column lists in `getContacts`,
  `getJobContacts`, `getCompanyContacts`, `getOrphanContacts` add the 3
  columns.
- `createContact`, `createCompanyContact`, `createPersonContact`,
  `updateContact` accept the 3 new `formData` fields, same optional
  `|| null` pattern already used for `phone`/`notes`.
- New `getJobsForMention()`.

`components/crm/crm-view.tsx`:
- `ContactsView`: table → card grid, add Tag filter select, replace inline
  create form with `ContactFormDialog` (create mode), add edit entry point
  (edit mode).
- `CompanyRow` / `ContactsPanel`: unchanged layout, forms gain 3 new fields
  (reuse `ContactFormDialog` in a compact context if it fits, else keep the
  existing small inline form with 3 more inputs — decide during
  implementation, whichever is the smaller diff).

New file `components/crm/contact-form-dialog.tsx` holds `ContactFormDialog`
so it's shared between the Contacts-tab grid and (optionally) the
Companies-tab panel.

## Out of scope

- Multi-tag contacts (single free-text tag only, per decision).
- Plain-text-only `@` (real job-linking mention chosen instead).
- Table/card view toggle (cards fully replace the table in the Contacts tab).
- Any change to `AddJobDialog`'s job-posting-detected-contact flow
  (`createJob`'s auto-contact-linking) — it still writes only `name`,
  `email`, `role` and that's unchanged.
- A dedicated `contact_tags` or `contact_note_mentions` table — both are
  derived/embedded instead, per the data model section.

## Testing

No test framework in the repo. Verification is manual: create a contact via
the popup with every field filled, confirm it renders on a card; edit it;
delete it; filter by company and by tag; type `@` in notes, pick a job,
confirm the rendered link navigates to `/jobs/[id]`; run
`node lib/db/selfcheck.ts` after any `query.ts`-adjacent change (none
expected, but the column additions touch `select()` calls it exercises).
