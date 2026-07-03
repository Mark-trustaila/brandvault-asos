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

See `brandvault-mev-build-plan.txt` in the project files for the full
six-phase sequenced plan. Phases 1-3 are the MEV:

1. Backend + Auth + Platform Admin
2. Platform Admin tools + Mark Editing (bulk entry, completeness indicators)
3. Bree (Slack) + Email Alerts

## Naming

- The Slack assistant is called **Bree**.
- Always refer to the founder as a **lawyer**, never attorney.

## Working style

- Be specific about what you're going to do BEFORE doing it.
- Warn before destructive operations.
- Don't repeat failed approaches — change tack.
- Take corrections immediately.
- Never invent names or details not in the codebase or project docs.
