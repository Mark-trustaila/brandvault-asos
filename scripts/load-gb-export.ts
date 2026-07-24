/**
 * Transforms a live-GB registry export into the BrandVault schema shape.
 * ======================================================================
 * Reports only. There is no write path in this file — no Prisma write call, no
 * --write flag. The load itself runs only after the plan in
 * docs/gb-load-plan.md is approved.
 *
 *   npx tsx scripts/load-gb-export.ts ~/lawpanel/scratch/exports/asos-gb-20260724.json
 *   npx tsx scripts/load-gb-export.ts <export.json> --json    # full mapped output
 *   npx tsx scripts/load-gb-export.ts <export.json> --excluded  # show what's skipped
 *
 * Source shape is verbatim GB registry XML flattened to JSON: dates arrive as a
 * path/value list, applicants and representatives as field/value pair groups,
 * and mark_text as a list (a mark may have no verbal element at all).
 */
import { readFileSync } from 'node:fs';
import { MarkStatus } from '@prisma/client';
import { getObligationsForTrademark } from '../lib/utils';
import type { Trademark } from '../types/trademark';

/* ─────────────────────────────────────────────────────────────────
 * Load scope: applicant-owned marks only.
 *
 * The export is the result of one ft:search over BOTH the owner and the
 * representative companion indexes, so it also contains marks where ASOS is
 * merely the representative on someone else's mark (EIGHT PAW PROJECTS,
 * Crooked Tongues, Covetique) and a same-name third party (Shenzhen asos
 * E-Commerce). Those are real register facts but they are not ASOS's portfolio,
 * so they are reported and skipped, never loaded.
 * ───────────────────────────────────────────────────────────────── */
const APPLICANTS_IN_SCOPE = new Set(['ASOS plc', 'ASOS HOLDINGS LIMITED']);

/* ─────────────────────────────────────────────────────────────────
 * STATUS MAPPING
 *
 * Source vocabulary (all four values present in this export, verified against
 * TradeMark/IPOPublicMarkCurrentStatusCode, which agrees on all 173 marks):
 *
 *   Registered · Withdrawn · Application Published · Examination
 *
 * Total:        every value above has an explicit entry; anything unrecognised
 *               is reported and would abort the load rather than defaulting.
 * Conservative: the two live-but-not-yet-registered states map to live enum
 *               values (Published / Pending), so a pending mark keeps showing
 *               up in the portfolio and in completeness prompts. Nothing maps
 *               to a dead value unless the register says the mark is dead.
 * Lossless:     the verbatim string is written to registry_status_raw for all
 *               rows regardless of what it maps to.
 *
 * Note on Withdrawn → Abandoned: a withdrawn UK application never registered,
 * so it carries no renewal obligation, and all 6 such marks here have neither a
 * registration date nor an expiry date — the deadline engine produces nothing
 * for them either way. Abandoned is the only enum value that means "the
 * applicant stopped pursuing it", which is what Withdrawn is.
 * ───────────────────────────────────────────────────────────────── */
const STATUS_MAP: Record<string, MarkStatus> = {
  Registered: MarkStatus.Registered,
  Withdrawn: MarkStatus.Abandoned,
  'Application Published': MarkStatus.Published,
  Examination: MarkStatus.Pending,
};

/** Stand-in for figurative marks with no verbal element — see the load plan. */
const NO_VERBAL_ELEMENT = '[device mark — no verbal element]';

/* ── source types ─────────────────────────────────────────────── */
interface FieldPair { field: string; value: string }
interface ExportMark {
  application_number: string;
  mark_text: string[];
  status: string;
  series_prefix: string;
  mark_feature: string;
  kind_mark: string;
  doc_name: string;
  node_id: string;
  matched_via: string[];
  matched_owner_strings: string[];
  dates: Array<{ path: string; value: string }>;
  goods_services: Array<{ class_number: string; description: string; language_code?: string }>;
  applicants: FieldPair[][];
  representatives: FieldPair[][];
  all_leaf_elements: Array<{ path: string; value: string }>;
}

/* ── helpers ──────────────────────────────────────────────────── */
const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length ? s : null;
};

/**
 * Take the registry's CALENDAR date, not an instant.
 *
 * GB dates arrive in three forms: '2034-07-15Z', '1979-11-13T00:00:00.000Z'
 * and '1969-07-15T00:00:00.000+01:00'. Parsing the last one with `new Date()`
 * yields 1969-07-14T23:00Z — the date moves back a day, because BST is +01:00.
 * 96 of the 173 in-scope marks carry at least one such date, so this is the
 * common case, not an edge case. A trademark date is a calendar date on the
 * register, so we take the leading YYYY-MM-DD and pin it to UTC midnight.
 */
const regDate = (v: unknown): Date | null => {
  const s = clean(v);
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const dateAt = (mk: ExportMark, suffix: string): Date | null =>
  regDate(mk.dates.find((d) => d.path.endsWith(suffix))?.value);

const pair = (groups: FieldPair[][], suffix: string): string | null => {
  for (const g of groups) for (const f of g) if (f.field.endsWith(suffix)) return clean(f.value);
  return null;
};

const applicantNames = (mk: ExportMark): string[] =>
  mk.applicants.flatMap((g) => g.filter((f) => f.field.endsWith('Applicant/Name')).map((f) => f.value));

/* ── target shape ─────────────────────────────────────────────── */
interface MappedMark {
  markText: string;
  markTextSynthesised: boolean;
  registryName: string;
  status: MarkStatus;
  registryStatusRaw: string;
  applicationNumber: string;
  registrationNumber: string | null;
  filingDate: Date | null;
  registrationDate: Date | null;
  expiryDate: Date | null;
  publicationDate: Date | null;
  ownerName: string | null;
  ownerCountry: string | null;
  representativeName: string | null;
  representativeReference: string | null;
  clientAgentName: string | null;
  needsData: boolean;
  seriesPrefix: string;
  goodsServices: Array<{ classNumber: number; description: string }>;
  projectedDeadlines: number;
}

function transform(mk: ExportMark): MappedMark {
  const filingDate = dateAt(mk, 'TradeMark/ApplicationDateTime');
  const registrationDate = dateAt(mk, 'TradeMark/RegistrationDate');
  const verbal = mk.mark_text.map(clean).filter((s): s is string => !!s);

  const shaped = {
    registry_name: 'UKIPO',
    filing_date: filingDate ? filingDate.toISOString() : undefined,
    registration_date: registrationDate ? registrationDate.toISOString() : undefined,
  } as Trademark;
  const obligations = getObligationsForTrademark(shaped);

  return {
    // A device mark genuinely has no verbal element; that is the nature of the
    // mark, not missing data, so it does not set needsData.
    markText: verbal[0] ?? NO_VERBAL_ELEMENT,
    markTextSynthesised: verbal.length === 0,
    registryName: 'UKIPO',
    status: STATUS_MAP[mk.status],
    registryStatusRaw: mk.status,
    applicationNumber: mk.application_number,
    // GB has no separate registration number — the application number carries
    // through on registration. Left null rather than duplicated.
    registrationNumber: null,
    filingDate,
    registrationDate,
    expiryDate: dateAt(mk, 'TradeMark/ExpiryDate'),
    publicationDate: dateAt(mk, 'PublicationDetails/Publication/PublicationDate'),
    ownerName: pair(mk.applicants, 'Applicant/Name'),
    ownerCountry: pair(mk.applicants, 'Applicant/AddressBook/CountryCode'),
    representativeName: pair(mk.representatives, 'Representative/Name'),
    // No Representative/Reference exists in GB register data.
    representativeReference: null,
    clientAgentName: null,
    needsData: obligations.some((o) => o.uncertain),
    seriesPrefix: mk.series_prefix,
    goodsServices: mk.goods_services.map((g) => ({
      classNumber: Number.parseInt(g.class_number, 10),
      description: g.description,
    })),
    projectedDeadlines: obligations.filter((o) => !o.uncertain && o.dueDate).length,
  };
}

/* ── main ─────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: npx tsx scripts/load-gb-export.ts <export.json> [--json] [--excluded]');
  process.exit(1);
}

const doc = JSON.parse(readFileSync(file.replace(/^~/, process.env.HOME ?? '~'), 'utf8'));
const header = doc.export ?? {};
const all: ExportMark[] = doc.marks ?? [];

const inScope = all.filter((m) => applicantNames(m).some((n) => APPLICANTS_IN_SCOPE.has(n)));
const excluded = all.filter((m) => !inScope.includes(m));
const mapped = inScope.map(transform);

const tally = <T>(xs: T[], k: (x: T) => string) =>
  xs.reduce<Record<string, number>>((a, x) => ((a[k(x)] = (a[k(x)] ?? 0) + 1), a), {});

const unmapped = Object.keys(tally(inScope, (m) => m.status)).filter((s) => !(s in STATUS_MAP));

console.log(`\nExport:      ${file}`);
console.log(`Source:      ${header.source ?? '(none)'}`);
console.log(`Exported:    ${header.export_date ?? '(none)'}`);
console.log(`GB docs:     ${header.gb_database_document_count ?? '(none)'}`);
if (header.index_scope_caveat) console.log(`Index scope: ${header.index_scope_caveat}`);
if (header.uk009_coverage_note) console.log(`UK009:       ${header.uk009_coverage_note}`);

console.log(`\n── SCOPE ──`);
console.log(`  marks in export        ${all.length}`);
console.log(`  in scope (applicant)   ${inScope.length}`);
console.log(`  excluded               ${excluded.length}`);
for (const [k, v] of Object.entries(tally(excluded, (m) => applicantNames(m)[0] ?? '(none)')).sort())
  console.log(`      ${k.padEnd(32)} ${v}`);

console.log(`\n── STATUS MAPPING ──`);
for (const [raw, n] of Object.entries(tally(inScope, (m) => m.status)).sort())
  console.log(`  ${(raw in STATUS_MAP ? '✓' : '✗')} ${raw.padEnd(24)} → ${String(STATUS_MAP[raw] ?? '(UNMAPPED)').padEnd(12)} ${n}`);

console.log(`\n── SERIES ──`);
for (const [k, v] of Object.entries(tally(mapped, (m) => m.seriesPrefix)).sort())
  console.log(`  ${k.padEnd(8)} ${v}`);

console.log(`\n── ROWS OUT ──`);
console.log(`  trademarks             ${mapped.length}`);
console.log(`  goods_and_services     ${mapped.reduce((n, m) => n + m.goodsServices.length, 0)}`);
console.log(`  deadlines (projected)  ${mapped.reduce((n, m) => n + m.projectedDeadlines, 0)}`);

console.log(`\n── COMPLETENESS ──`);
console.log(`  needsData                    ${mapped.filter((m) => m.needsData).length}`);
console.log(`  synthesised mark text        ${mapped.filter((m) => m.markTextSynthesised).length}`);
console.log(`  missing filing date          ${mapped.filter((m) => !m.filingDate).length}`);
console.log(`  missing registration date    ${mapped.filter((m) => !m.registrationDate).length}`);
console.log(`  missing expiry date          ${mapped.filter((m) => !m.expiryDate).length}`);
console.log(`  with representative          ${mapped.filter((m) => m.representativeName).length}`);
console.log(`  owner name present           ${mapped.filter((m) => m.ownerName).length}`);
console.log(`  bad class numbers            ${mapped.reduce((n, m) => n + m.goodsServices.filter((g) => !Number.isInteger(g.classNumber)).length, 0)}`);

console.log(`\n── OWNER SPLIT ──`);
for (const [k, v] of Object.entries(tally(mapped, (m) => m.ownerName ?? '(none)')).sort())
  console.log(`  ${k.padEnd(24)} ${v}`);

if (argv.includes('--excluded')) {
  console.log(`\n── EXCLUDED MARKS ──`);
  for (const m of excluded)
    console.log(`  ${m.application_number}  ${(applicantNames(m)[0] ?? '?').padEnd(30)} via ${m.matched_via.join('+')}  ${m.mark_text.join(' / ')}`);
}

if (argv.includes('--json')) console.log(JSON.stringify({ header, mapped }, null, 2));

if (unmapped.length) {
  console.error(`\nUNMAPPED STATUS VALUES — load must not proceed: ${unmapped.join(', ')}`);
  process.exit(1);
}

console.error('\nReport only — nothing written. Load runs after docs/gb-load-plan.md is approved.');
