# Spec: Self-serve portfolio population (dark launch)

For: BrandVault project (repo: brandvault-asos). Companion to the Portfolio Import
handoff (2026-07-25). Read that first: this spec builds on its facade, loader, and
transform decisions and does not restate them.

Status: build dark behind a feature flag as part of the admin-import project.
Launch is a separate, deliberate decision gated on the criteria in §7.

## 1. What this is

The admin import flow (handoff §3b) exposed to new customers at signup. A user signs
up, enters their company name, selects the owner strings that are theirs, previews,
confirms, and lands on a populated portfolio with deadlines generated. No concierge
step required.

Everything in the handoff doc applies unchanged: the facade is the only registry
read path, the promoted loader is the only write path, and the reviewed transform
decisions are settled. This spec covers only the self-serve delta.

## 2. Relationship to the admin flow

One import pipeline, two entry points:

- Admin entry: platform admin, cross-tenant, runs during or ahead of a concierge
  call. Ships live.
- Self-serve entry: org member (admin role) on their own tenant, reached from
  first-run onboarding or from Settings. Ships dark.

Shared: facade client, owner-selection UI, preview, loader invocation, provenance
labelling, "as at" date display, idempotent re-import. Build these once as common
components; the two entry points differ only in auth context, chrome, and copy.

## 3. Flow

### 3a. First-run sequence
1. Clerk signup and organisation creation (existing).
2. If flag enabled and org has zero marks: land on the import wizard, not the
   dashboard. Wizard is skippable ("Set up later"), returning the user to the
   standard empty dashboard with a persistent "Import your portfolio" prompt.
3. Search step: company name input. Calls facade search-by-owner.
4. Selection step: matched owner strings as checkboxes with per-string mark counts.
   Owner matches and representative-only matches visually distinct.
   Representative-only rows are shown but disabled in v1 (handoff open question 3,
   decided): visible as intelligence, not importable.
5. Preview step: counts by status and series, sample marks, the "as at" date, and
   the coverage copy from §5.
6. Confirm: loader runs server-side in a transaction. Progress indicator; on
   completion, land on the populated dashboard.
7. Post-import: standard product. Manual "Re-sync from registry" button on the
   portfolio (handoff open question 4, decided: manual in v1).
8. Every self-serve import fires a Slack ping to Mark (org name, owner strings
   selected, mark count): each import is a sales lead and a QA sample while
   volumes are small. Decided, in scope for the dark build.

### 3b. States that need answers
- Search returns nothing: offer manual entry and a "talk to us" path. Never a dead
  end.
- Search returns only representative matches: explain the distinction in plain
  language, offer the same two paths.
- Abandoned mid-wizard: resumable from the persistent prompt; no partial writes
  exist because the loader is transactional.
- Import fails (unmapped status, facade timeout, count mismatch): loader aborts and
  rolls back per its existing gates. User sees a plain failure message with a
  "talk to us" path; the error detail goes to the ops log, not the user.
- Re-signup or re-import: idempotent by application number per the handoff; the
  wizard states that re-importing refreshes rather than duplicates.

## 4. Protections

The public-ish search surface is the only genuinely new risk. All protections live
server-side in the BrandVault backend, in front of the facade client:

- Rate limit per org: N searches per hour (config, default 10) and M imports per
  day (default 3). Exceeding either returns a friendly limit message.
- Rate limit per IP on the search endpoint as a backstop against enumeration
  through throwaway signups.
- Result cap: owner queries matching more than the facade cap (~2,000 marks)
  return a "contact us" response, not a paginated preview (handoff open question 2,
  decided).
- Search queries and import events logged per org (query text, match counts,
  imported counts, timestamps): abuse evidence and product telemetry in one table.
- The facade API key never reaches the client. All facade calls are server-side.

## 5. Coverage and expectation copy

Load-bearing in self-serve because no one is on a call to frame it:

- Preview and portfolio show "UK registry data as at <date>" sourced from the
  facade, per the handoff.
- Until the UK009 ingest completes registry-side: the preview carries the partial
  comparable-coverage wording from handoff §3d. Remove on registry-side
  confirmation.
- Live marks only, per the handoff: no lapsed-mark history is implied anywhere.
- Per-mark provenance labels (registry-synced vs manual) carry the UK-vs-other
  distinction for now; explicit post-import gap copy deferred, revisit at flag-on.
- If the registry inventory (in flight) promotes further registries to "yes", the
  facade's registry parameter extends this flow without UI change beyond copy and
  the per-registry provenance labels.

## 6. Feature flag

- Single flag: SELF_SERVE_IMPORT (env var, default off, per the AUTO_ACT pattern).
- Off: signup lands on the standard dashboard; no wizard, no search endpoint
  exposure for non-platform-admin users (the route itself checks the flag, not
  just the UI).
- On: full flow in §3.
- The admin entry point ignores the flag entirely.

## 7. Launch criteria (decision gate, not a date)

Flip the flag only when all of:
1. Concierge onboarding is demonstrably the bottleneck (prospects waiting on Mark's
   availability), or a strategic need (investor narrative, partnership) justifies
   public self-serve.
2. Registry-side: catch-up swap complete and daily WebJob proven; UK009 baseline
   ingested (or the partial-coverage copy consciously accepted for launch).
3. A pricing and billing answer exists for users who arrive without a call, even
   if that answer is "imports free, product trial, invoice on conversion".
4. Support path defined: where "talk to us" actually lands (email, calendar link)
   and who answers it.
5. One full rehearsal of the flow end to end, performed by Mark before flag-on.

## 8. Out of scope for v1

- Non-UK registry import (pending inventory; the facade parameter is the ready
  seam).
- Scheduled per-portfolio re-sync (manual button only).
- Representative-only mark import (shown-but-disabled).
- CSV upload merged into this wizard (separate feature, existing plan).
- Billing integration, plan gating, trial mechanics beyond the flag.
- The marketing-site teaser (separate one-page spec; shares the facade search
  endpoint and the §4 protections, nothing else).

## 9. Open questions for the product owner

1. Wizard placement for existing orgs: Settings only, or also a dashboard prompt
   when a portfolio has zero registry-synced marks?
2. Default rate-limit numbers in §4: confirm or adjust before flag-on.
3. Whether "Set up later" skippers get a nudge sequence (email after 48h) or are
   left alone until they return.

## 10. Boundaries restated

Per the handoff: facade read-only against BaseX, imports write only to BrandVault's
own DB scoped per company, shared preview/prod Azure MySQL means every migration
follows the staged-and-reviewed pattern, and CLAUDE.md repo rules apply throughout
(records never merged, families explicit, three required fields, reason-required
edits).
