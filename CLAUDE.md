# BrandVault

Trademark portfolio management SaaS. Part of the AiLA product suite.

## What this is

Next.js 14 frontend currently serving a static JSON snapshot of 81 ASOS marks
across 8 registries. Being evolved into a full product with backend, auth,
Slack integration, and multi-tenant data.

## Stack

- **Frontend:** Next.js 14 / React 18 / TypeScript on Vercel
- **Auth:** Clerk (company-as-customer, roles: admin / editor / viewer + platform admin)
- **Backend:** Next.js API routes + Prisma ORM + Azure Database for MySQL
- **Slack:** Bree (the BrandVault Slack assistant)
- **Email:** SMTP via Azure (secondary alert channel)

## CSS rules

- Existing components use CSS Modules. Do not migrate them.
- All new components use Tailwind. Design tokens in tailwind.config.
- Never mix CSS Modules and Tailwind within a single component.

## Code to preserve

- `lib/utils.ts` — the obligation/deadline engine is production-quality.
  Jurisdiction-specific renewal rules for 7 registries. Do not rewrite
  unless explicitly asked.

## Data model rules

- Trademark families are explicit entities, not inferred from mark_text matching.
- Individual legal rights records are NEVER merged. Pre/post-Brexit conversion
  records, Madrid designations, and national registrations remain distinct
  even when they share a family.
- Minimum required fields for a mark: mark_text, registry_name, status.
  All other fields optional. Handle incomplete records gracefully —
  completeness prompts, not blocking errors.
- Deadline engine skips marks with missing dates and flags them as "needs data."

## Platform admin

- Cross-tenant access for BrandVault operations (onboarding, data correction).
- Platform admin edits require a reason and are audit-logged separately.
- Customer activity feed shows "Updated by BrandVault Support" for admin changes.

## Onboarding model (first ~10-15 customers)

Concierge. Mark enters data via platform admin. No CSV self-service import
at MEV — that's built later when concierge stops scaling.

## Build plan

Status (2026-07-06): **Phases 1–4 complete and live in production**
(brandvault-asos.vercel.app · Azure Database for MySQL · Clerk). See
`brandvault-mev-build-plan.txt` for the full plan; Phases 5–7 remain.

1. Backend + Auth + Platform Admin — ✅
2. Platform Admin tools + Mark Editing (bulk entry, completeness) — ✅
3. Bree (Slack) + alerts — ✅ (Slack live; SMTP email deferred)
4. Email Integration (Bree Inbound) — ✅ forwarding-address ingestion
   (Postmark) → content-first classification (Claude, claude-sonnet-4-6) →
   HIGH-confidence auto-actions + renewal reconciliation → Bree Slack alerts →
   /inbox human review with corpus feedback. Every auto-action audited as
   actor="Bree". Spec: `brandvault-phase4-email-integration.txt`.

Post-MEV, not started: 5. CSV self-service import · 6. Bree command surface
expansion · 7. Multi-jurisdiction rules + teams.

## Naming

- The Slack assistant is called **Bree**.
- Always refer to the founder as a **lawyer**, never attorney.

## Working style

- Be specific about what you're going to do BEFORE doing it.
- Warn before destructive operations.
- Don't repeat failed approaches — change tack.
- Take corrections immediately.
- Never invent names or details not in the codebase or project docs.

## GitHub accounts

This repo is under the **Mark-trustaila** account, but the gh/terminal default is
**Markk-w**, which has only *read* access here. Pushing or opening PRs requires
switching first:

```bash
gh auth switch --user Mark-trustaila   # push / PR on this repo
gh auth switch --user Markk-w          # switch back (default; LawPanel repos)
```

If Mark-trustaila isn't authenticated, add it once with `gh auth login`.
`git fetch`/clone work as Markk-w without switching — only writes need Mark-trustaila.
