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

## Environment variables (Vercel)

Set per scope in Vercel → Settings → Environment Variables. **Build** vars must
exist at build time or `next build` fails during prerender; **runtime** vars are
read when the function executes. `.env.example` documents all of them.

| Variable | Purpose | Needed at | Prod | Preview | Local | Notes |
|---|---|---|---|---|---|---|
| `DATABASE_URL` | Prisma → Azure MySQL | runtime | ✅ | ✅ | ✅ | Separate values per scope, but Preview & Production point at the **SAME Azure DB** (`brandvault-mysql…/brandvault`). **KNOWN DECISION — accepted for MEV (2026-07-14); SEPARATE THE PREVIEW DB BEFORE THE FIRST EXTERNAL CUSTOMER.** Until then, preview testing writes to prod data — purge test rows before demos. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk (browser) | **build**+runtime | ✅ | ✅ | ✅ | Missing at build → prerender fails (`Missing publishableKey`). |
| `CLERK_SECRET_KEY` | Clerk (server/middleware) | runtime | ✅ | ✅ | ✅ | Missing → 500 `MIDDLEWARE_INVOCATION_FAILED`. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` | Clerk routing | build+runtime | ✅ | ✅ | ✅ | `/sign-in`, `/sign-up`. |
| `ANTHROPIC_API_KEY` | email + Bree-intent classifiers | runtime | ✅ | ✅ | ✅ (`.env`) | Sensitive. **Confirmed added by operator 2026-07-14** (brandvault-asos project only; Prod + Preview). Did NOT exist in any Vercel scope before then — so the deployed email classifier had never run live. Absent → email classifier throws (email stays `pending`); intent → graceful `unsupported`. Read ONLY from env (SDK default `new Anthropic()`), no other source. |
| `EMAIL_CLASSIFIER_MODEL` | model override | runtime | opt | opt | opt | default `claude-sonnet-4-6`. |
| `BREE_INTENT_MODEL` | model override | runtime | opt | opt | opt | default `claude-haiku-4-5`. |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_SIGNING_SECRET` | Bree OAuth + slash-signature verify | runtime | ✅ | opt | ✅ | Slash/OAuth work where set. |
| `NEXT_PUBLIC_APP_URL` | deep-link + Bree icon base URL | build+runtime | opt | opt | opt | default `https://brandvault-asos.vercel.app`. |
| `POSTMARK_INBOUND_SECRET` | inbound webhook auth | runtime | ✅ | opt | ✅ | Route returns 503 without it. |
| `INBOUND_FALLBACK_COMPANY_SLUG` | testing: hash addr → company | runtime | `asos-plc` | opt | opt | routes the Postmark hash address to a company. |
| `CRON_SECRET` | cron + `/api/email/process` guard | runtime | ✅ | opt | – | Guards those endpoints (Bearer). |
| `SEED_CLERK_ORG_ID` | link seed data to a Clerk org | seed | – | – | opt | local seed only. |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | email alert channel | runtime | – | – | – | **Not wired** — email deferred; the alert job counts + skips email gracefully. |

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

Bree/Slack **verified live 2026-07-08** (LawPanel workspace): slash commands,
weekly digest, renewal alerts + `alert_sent` dedup, email-fallback graceful-skip.
Fixes that session: slash-command cold-start timeout (ack immediately, deliver
via Slack `response_url` using `@vercel/functions` `waitUntil`); enterprise tone
(decorative emoji removed); Bree app icon on every message (self-hosted
`public/bree-icon.png` as `icon_url`, so digests/alerts match the slash-reply
avatar). Deferred in Phase 3: approval-flow foundation is a stub
(`/api/slack/interactivity` verifies + acks, but no buttons post to AuditLog
yet); SMTP email channel not wired (alerts count and skip email gracefully).

1. Backend + Auth + Platform Admin — ✅
2. Platform Admin tools + Mark Editing (bulk entry, completeness) — ✅
3. Bree (Slack) + alerts — ✅ live-verified (Slack; SMTP email deferred)
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
