/**
 * SKELETON — loads a live-GB registry export into the BrandVault schema.
 * =====================================================================
 * Status: structure only. It parses, maps, counts and reports. It does NOT
 * write, and the status-mapping table below is deliberately unfilled.
 *
 *   npx tsx scripts/load-gb-export.ts <export.json>          # parse + report
 *   npx tsx scripts/load-gb-export.ts <export.json> --json
 *
 * There is no --write flag and no Prisma write call anywhere in this file. The
 * load itself is not implemented, because two of its inputs do not exist yet:
 *
 *   1. The real export file. Field names, date formats and the actual status
 *      vocabulary are assumptions until a real file is in hand — the interface
 *      below is written from the agreed export spec, not from observed data.
 *   2. An approved load plan. The 33 fabricated UKIPO marks currently in the
 *      database have children (Deadline, Notification, GoodsService, AuditLog,
 *      and possibly Note / InboundEmail / Approval / BreeQueryLog rows). How
 *      each is treated — deleted with its mark, re-pointed, or left alone — is
 *      a decision for review, not something to infer here.
 *
 * Preview and Production share one Azure database, so nothing in this path
 * writes without that plan being signed off first.
 */
import { readFileSync } from 'node:fs';
import { MarkStatus } from '@prisma/client';

/* ─────────────────────────────────────────────────────────────────
 * Expected export record.
 *
 * From the agreed export spec: raw registry truth, nothing transformed. Every
 * field is optional because incomplete records are first-class in this schema
 * (minimum required: mark_text, registry_name, status) and the loader must not
 * reject a mark for missing dates — it flags needsData instead.
 *
 * VERIFY AGAINST THE REAL FILE before trusting any of these names.
 * ───────────────────────────────────────────────────────────────── */
interface ExportRecord {
  application_number?: string;
  mark_text?: string;
  /** Verbatim registry vocabulary, unmapped. Drives STATUS_MAP below. */
  status?: string;
  application_date?: string;
  registration_date?: string;
  expiry_date?: string;
  publication_date?: string;
  /** Owner / representative as they appear in the register. */
  owner_name?: string;
  owner_country?: string;
  representative_name?: string;
  representative_reference?: string;
  goods_services?: Array<{ class_number?: number; text?: string }>;
  /** UK000 / UK008 / UK009 — present in the export, re-derived here as a check. */
  series_prefix?: string;
  [k: string]: unknown;
}

/* ─────────────────────────────────────────────────────────────────
 * STATUS MAPPING — FILL IN AFTER READING THE REAL EXPORT.
 *
 * Left empty on purpose. The distinct status values are a *finding* of the
 * export (report item 3), not something to guess: a mapping table invented
 * ahead of the data looks authoritative and would be reviewed as if it were
 * real. Populate from the reported distinct values, then review.
 *
 * Rules this table must satisfy:
 *   - Conservative. Where a registry value could mean either a live or a dead
 *     mark, map to the one that keeps an obligation visible. A mark wrongly
 *     shown as dead silences a renewal deadline — the worst failure this
 *     product can produce.
 *   - Total. Every distinct value in the export gets an explicit entry. An
 *     unmapped value aborts the load rather than defaulting.
 *   - Lossless in practice. The verbatim string is preserved in
 *     registry_status_raw regardless of what it maps to.
 *
 * Enum values available: Registered · Pending · Published · Expired · Abandoned
 *
 * Example of the intended shape (NOT a proposal — do not adopt unreviewed):
 *   'Registered': MarkStatus.Registered,
 *   'Dead':       ???  // Expired vs Abandoned — depends on why it died
 * ───────────────────────────────────────────────────────────────── */
const STATUS_MAP: Record<string, MarkStatus> = {
  // TODO — populate from the export's distinct status values, then review.
};

/* ─────────────────────────────────────────────────────────────────
 * Transform
 * ───────────────────────────────────────────────────────────────── */
interface MappedMark {
  markText: string;
  registryName: 'UKIPO';
  status: MarkStatus | null;
  /** Verbatim registry status — needs the pending registry_status_raw column. */
  registryStatusRaw: string | null;
  applicationNumber: string | null;
  registrationNumber: string | null;
  filingDate: Date | null;
  registrationDate: Date | null;
  expiryDate: Date | null;
  publicationDate: Date | null;
  ownerName: string | null;
  ownerCountry: string | null;
  representativeName: string | null;
  representativeReference: string | null;
  goodsServices: Array<{ classNumber: number | null; text: string | null }>;
  seriesPrefix: string | null;
  /** Set when a date the deadline engine needs is missing. */
  needsData: boolean;
}

const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length ? s : null;
};

/** Permissive on input, explicit on failure — an unparseable date is not zero. */
const date = (v: unknown): Date | null => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** UK00009… → UK009. Re-derived rather than trusted, then cross-checked. */
const seriesOf = (appNo: string | null): string | null => {
  if (!appNo) return null;
  const m = /^UK(\d{3})/.exec(appNo.trim().toUpperCase());
  return m ? `UK${m[1]}` : null;
};

function transform(rec: ExportRecord): MappedMark {
  const applicationNumber = str(rec.application_number);
  const filingDate = date(rec.application_date);
  const registrationDate = date(rec.registration_date);
  const rawStatus = str(rec.status);

  return {
    markText: str(rec.mark_text) ?? '',
    registryName: 'UKIPO',
    status: rawStatus ? (STATUS_MAP[rawStatus] ?? null) : null,
    registryStatusRaw: rawStatus,
    applicationNumber,
    // The export spec does not carry a separate registration number; GB marks
    // reuse the application number. Confirm against the real file.
    registrationNumber: null,
    filingDate,
    registrationDate,
    expiryDate: date(rec.expiry_date),
    publicationDate: date(rec.publication_date),
    ownerName: str(rec.owner_name),
    ownerCountry: str(rec.owner_country),
    representativeName: str(rec.representative_name),
    representativeReference: str(rec.representative_reference),
    goodsServices: (rec.goods_services ?? []).map((g) => ({
      classNumber: typeof g.class_number === 'number' ? g.class_number : null,
      text: str(g.text),
    })),
    seriesPrefix: seriesOf(applicationNumber),
    // Mirrors the deadline engine's contract: no filing and no registration
    // date means no renewal date can be computed.
    needsData: !filingDate && !registrationDate,
  };
}

/* ─────────────────────────────────────────────────────────────────
 * Main — parse, map, report. No writes.
 * ───────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const path = argv.find((a) => !a.startsWith('--'));
const asJson = argv.includes('--json');

if (!path) {
  console.error('usage: npx tsx scripts/load-gb-export.ts <export.json> [--json]');
  process.exit(1);
}

const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));

// The export carries a header block (source, export date, UK009 coverage note)
// alongside the marks. Accept either that or a bare array.
const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const root = asRecord(parsed);
const header = asRecord(root.header ?? root.meta);
const records: ExportRecord[] = Array.isArray(parsed)
  ? (parsed as ExportRecord[])
  : ((root.marks ?? root.trademarks ?? root.records ?? []) as ExportRecord[]);

if (!Array.isArray(records) || records.length === 0) {
  console.error(`No records found in ${path}. Top-level keys: ${Object.keys(root).join(', ') || '(none)'}`);
  process.exit(1);
}

const mapped = records.map(transform);

const tally = <T>(xs: T[], key: (x: T) => string | null) =>
  xs.reduce<Record<string, number>>((acc, x) => {
    const k = key(x) ?? '(none)';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

const bySeries = tally(mapped, (m) => m.seriesPrefix);
const byRawStatus = tally(mapped, (m) => m.registryStatusRaw);
const unmapped = Object.keys(byRawStatus).filter((s) => s !== '(none)' && !(s in STATUS_MAP));

const summary = {
  source: path,
  header,
  recordsIn: records.length,
  mapped: mapped.length,
  bySeries,
  byRawStatus,
  unmappedStatuses: unmapped,
  needsData: mapped.filter((m) => m.needsData).length,
  missingMarkText: mapped.filter((m) => !m.markText).length,
  missingApplicationNumber: mapped.filter((m) => !m.applicationNumber).length,
  withOwner: mapped.filter((m) => m.ownerName).length,
  withRepresentative: mapped.filter((m) => m.representativeName).length,
  goodsServiceRows: mapped.reduce((n, m) => n + m.goodsServices.length, 0),
};

if (asJson) {
  console.log(JSON.stringify({ summary, marks: mapped }, null, 2));
} else {
  console.log(`\nExport: ${path}`);
  if (Object.keys(header).length) console.log(`Header: ${JSON.stringify(header)}`);
  console.log(`\nRecords in:            ${summary.recordsIn}`);
  console.log(`Mapped:                ${summary.mapped}`);
  console.log(`\nBy series prefix:`);
  for (const [k, v] of Object.entries(bySeries).sort()) console.log(`  ${k.padEnd(8)} ${v}`);
  console.log(`\nBy verbatim registry status:`);
  for (const [k, v] of Object.entries(byRawStatus).sort()) {
    console.log(`  ${(k in STATUS_MAP ? '✓' : '✗')} ${k.padEnd(28)} ${v}`);
  }
  console.log(`\nCompleteness:`);
  console.log(`  needsData (no filing/registration date): ${summary.needsData}`);
  console.log(`  missing mark_text:                       ${summary.missingMarkText}`);
  console.log(`  missing application_number:              ${summary.missingApplicationNumber}`);
  console.log(`  with owner:                              ${summary.withOwner}`);
  console.log(`  with representative:                     ${summary.withRepresentative}`);
  console.log(`  goods/services rows:                     ${summary.goodsServiceRows}`);
}

if (unmapped.length) {
  console.error(`\n${unmapped.length} unmapped status value(s) — STATUS_MAP must be filled in and reviewed:`);
  for (const s of unmapped) console.error(`  "${s}"  (${byRawStatus[s]} marks)`);
}

console.error('\nSKELETON — no data was written. The load needs: the real export, a filled-in');
console.error('STATUS_MAP, the pending registry_status_raw migration applied, and an approved');
console.error('load plan for the 33 existing fabricated marks and their child rows.');
