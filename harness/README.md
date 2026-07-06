# Email classification harness (Phase 4, Step 1)

Proves Bree's inbound-email classification accuracy **locally, against real
correspondence, before any ingestion infrastructure is built.** No database, no
webhook, no deploy.

## Run

```bash
# Synthetic committed fixtures (safe, in-repo demo)
npm run harness:fixtures

# Your real corpus (gitignored — see Data hygiene)
npm run harness
```

Requires `ANTHROPIC_API_KEY` in `.env` (loaded automatically; local only).
Model defaults to `claude-sonnet-4-6`, override with `EMAIL_CLASSIFIER_MODEL`.

## What it reports

Per email it classifies subject + body + extracted PDF attachment text, then
compares to the label: registry, communication type, reference-number recall,
and confidence. The **gate that fails the run** is any email classified into
**HIGH confidence with the wrong registry/type** — that is the dangerous failure
(it would trigger a wrong automatic action). Everything else is reported but
does not fail the run; tune prompts to push registry+type accuracy up while
keeping dangerous failures at zero.

## Real corpus — data hygiene

Real TMD client correspondence **never gets committed and never touches the
deployed database.** Only the synthetic `fixtures/` are in the repo.

```
harness/
  fixtures/            # committed, synthetic — no client data
  fixtures/labels.jsonl
  email-corpus/        # GITIGNORED — drop real .eml files here
  labels.jsonl         # GITIGNORED — one JSON object per line (see below)
```

Label format (one JSON object per line):

```json
{"file":"example.eml","registry":"UKIPO","type":"registration_certificate","refs":["UK00003456789"],"expectHigh":true,"action":"free text"}
```

`registry` ∈ UKIPO | EUIPO | WIPO | other | unknown.
`type` ∈ the `CommunicationType` values in `lib/email-types.ts`.

## Regenerate the PDF fixture

`forwarded-ref-in-pdf.eml` (reference number only in the PDF) is generated:

```bash
npm run harness:gen-pdf
```
