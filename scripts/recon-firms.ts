/**
 * One-off recon: LawPanel Firms API ⇄ BrandVault import feasibility.
 * ==================================================================
 * NOT wired into the app. Nothing imports this. Read-only throughout: it makes
 * GET requests to the Firms API and SELECTs against the BrandVault DB. It never
 * writes to either.
 *
 *   npx tsx scripts/recon-firms.ts                 # no key: sections A/C/D + baseline
 *   LAWPANEL_KEY=<sub-key> npx tsx scripts/recon-firms.ts
 *   npx tsx scripts/recon-firms.ts --json > recon.json
 *
 * Flags:
 *   --host <h>   gateway host (default lawpanel.azure-api.net — see below)
 *   --insecure   skip TLS verification (needed only for api.lawpanel.com)
 *   --json       machine-readable output
 *
 * WHY THE DEFAULT HOST IS NOT api.lawpanel.com
 * --------------------------------------------
 * The custom domain api.lawpanel.com serves a wildcard *.lawpanel.com cert that
 * EXPIRED 2024-11-07. Every validating client (curl, Node https/fetch) refuses
 * the connection — including the original brandvault fetch script. The same APIM
 * instance is reachable on its default hostname lawpanel.azure-api.net with a
 * valid Microsoft-issued cert, so we default there. Same gateway, same APIs.
 *
 * WHAT THIS REPLACES
 * ------------------
 * The original fetch script (~/brandvault/brandvault/scripts/lawpanel-fetch-trademarks.js;
 * never existed in this repo) authenticated by POSTing to /v1/firms/login before
 * paging /v1/firms/firmportfolio. That login endpoint returns 404 — it does not
 * exist on the gateway. APIM auth is the subscription key header alone.
 */
import { prisma } from '../lib/db';

/* ── args ─────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string, d: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const HOST = opt('host', 'lawpanel.azure-api.net');
const BASE = `https://${HOST}/v1/firms`;
const KEY = process.env.LAWPANEL_KEY || '';
const JSON_OUT = flag('json');

if (flag('insecure')) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const report: Record<string, unknown> = { host: HOST, base: BASE, keyPresent: !!KEY };
const out: string[] = [];
const say = (s = '') => {
  out.push(s);
  if (!JSON_OUT) console.log(s);
};
const h = (t: string) => say(`\n${t}\n${'─'.repeat(t.length)}`);

/* ── http ─────────────────────────────────────────────────────── */
type Probe = { status: number | null; ms: number; body: string; error?: string };

async function call(path: string, method = 'GET', body?: unknown): Promise<Probe> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(KEY ? { 'Ocp-Apim-Subscription-Key': KEY } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    return { status: res.status, ms: Date.now() - t0, body: (await res.text()).slice(0, 4000) };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const cause = e instanceof Error && e.cause instanceof Error ? ` (${e.cause.message})` : '';
    return { status: null, ms: Date.now() - t0, body: '', error: err + cause };
  }
}

/* ─────────────────────────────────────────────────────────────────
 * (a) Does it respond? Does auth work?
 * ───────────────────────────────────────────────────────────────── */
async function sectionA() {
  h('(a) REACHABILITY + AUTH');

  const probe = await call('/firmportfolio?take=1&skip=0');
  const verdict =
    probe.error
      ? `TRANSPORT FAILURE — ${probe.error}`
      : probe.status === 200
        ? 'OK — gateway responds and the subscription key is accepted'
        : probe.status === 401
          ? KEY
            ? 'REJECTED — key present but not accepted (401). Wrong/revoked key, or no subscription for this API.'
            : 'ALIVE but UNAUTHENTICATED — no LAWPANEL_KEY set (expected 401).'
          : probe.status === 403
            ? 'FORBIDDEN — key recognised but lacks entitlement to this API/product (403).'
            : `UNEXPECTED — HTTP ${probe.status}`;

  say(`GET ${BASE}/firmportfolio?take=1&skip=0`);
  say(`  → ${probe.error ? 'no response' : `HTTP ${probe.status}`}  (${probe.ms}ms)`);
  say(`  → ${verdict}`);
  if (probe.body) say(`  → body: ${probe.body.slice(0, 300)}`);

  // TLS check on the custom domain is the thing that bit the old script.
  if (HOST !== 'api.lawpanel.com') {
    const legacy = await fetch('https://api.lawpanel.com/v1/firms/firmportfolio', {
      signal: AbortSignal.timeout(20_000),
    }).then(
      (r) => `responds HTTP ${r.status}`,
      (e) => `FAILS — ${e instanceof Error && e.cause instanceof Error ? e.cause.message : e}`,
    );
    say(`\nLegacy custom domain api.lawpanel.com: ${legacy}`);
  }

  report.reachability = { verdict, status: probe.status, ms: probe.ms, error: probe.error };
  return probe;
}

/* ─────────────────────────────────────────────────────────────────
 * (c) Endpoint inventory.
 *
 * APIM routes on method+path BEFORE checking the subscription key, so an
 * unauthenticated probe still distinguishes a real operation (401 = matched,
 * key missing) from a non-existent one (404 = no operation matched). That means
 * the surface can be mapped with no credentials at all.
 * ───────────────────────────────────────────────────────────────── */
const CANDIDATES: Array<[string, string]> = [
  ['GET', '/firmportfolio'],
  ['POST', '/firmportfolio'],
  ['GET', '/firmportfolio/1'],
  ['GET', '/firmportfolio/1/2'],
  ['GET', '/search'],
  ['GET', '/search/1'],
  ['GET', '/search/owner'],
  ['GET', '/search/trademarks'],
  ['GET', '/client'],
  ['GET', '/client/1'],
  ['GET', '/users'],
  ['GET', '/users/1'],
  ['POST', '/login'],
  ['GET', '/trademarks'],
  ['GET', '/owners'],
  ['GET', '/me'],
];

async function sectionC() {
  h('(c) ENDPOINT INVENTORY');
  say('401/404 = operation exists / does not exist (APIM routes before auth).');
  say('With a valid key: 200 = usable, 403 = exists but not entitled.\n');

  // SAFETY: a POST probe is only harmless while it is guaranteed to 401. With a
  // real key, POST /firmportfolio could create data in LawPanel — this script is
  // strictly read-only, so non-GET probes are skipped whenever a key is present.
  if (KEY) say('  (non-GET probes skipped — a key is present and this script never writes)\n');

  const rows: Array<{ method: string; path: string; status: number | null; exists: boolean; skipped?: boolean }> = [];
  for (const [method, path] of CANDIDATES) {
    if (KEY && method !== 'GET') {
      rows.push({ method, path, status: null, exists: false, skipped: true });
      say(`  ~ ${method.padEnd(5)} ${path.padEnd(24)} SKIPPED (write-capable verb)`);
      continue;
    }
    const r = await call(path, method, method === 'POST' && path === '/login' ? { username: 'x', password: 'y' } : undefined);
    const exists = r.status !== null && r.status !== 404;
    rows.push({ method, path, status: r.status, exists });
    say(`  ${exists ? '✓' : '·'} ${method.padEnd(5)} ${path.padEnd(24)} ${r.status ?? 'ERR'}`);
  }

  const live = rows.filter((r) => r.exists);
  say('');
  say(`Operations that exist: ${live.length}/${rows.length}`);

  // The question that decides import shape: can we search by proprietor name,
  // or only fetch what the firm already dockets?
  const hasSearch = live.some((r) => r.path.startsWith('/search'));
  const hasPortfolio = live.some((r) => r.path.startsWith('/firmportfolio'));
  say('');
  say('Search capability:');
  say(`  /search* present:        ${hasSearch ? 'YES' : 'no'}`);
  say(`  /firmportfolio present:  ${hasPortfolio ? 'YES' : 'no'}`);
  if (!KEY) {
    say('  NOTE: whether /search takes a proprietor NAME or only an identifier');
    say('  cannot be determined from a 401 — it needs a key to read the contract.');
  }

  report.endpoints = rows;
  return rows;
}

/* ─────────────────────────────────────────────────────────────────
 * (b) Diff API GB marks against current production data.
 * ───────────────────────────────────────────────────────────────── */
const norm = (s: string | null | undefined) => (s || '').trim().toUpperCase();
const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : '';

/** Field names taken from the old fetch script + the shipped JSON snapshots. */
type ApiMark = Record<string, any>;

const isGb = (m: ApiMark) =>
  /UKIPO|UK IPO|^GB$|UNITED KINGDOM/i.test(String(m.registry_name || m.registry_official_name || ''));

async function sectionB(authed: boolean) {
  h('(b) GB DIFF — API vs PRODUCTION');

  const prod = await prisma.trademark.findMany({
    where: { registryName: { contains: 'UK' } },
    select: {
      markText: true, applicationNumber: true, registrationNumber: true, status: true,
      filingDate: true, registrationDate: true, expiryDate: true, ownerName: true,
      company: { select: { slug: true } },
    },
    orderBy: { applicationNumber: 'asc' },
  });

  const prodUk009 = prod.filter((m) => norm(m.applicationNumber).startsWith('UK009'));
  say(`Production GB marks: ${prod.length}`);
  say(`  UK009-prefixed (post-Brexit comparable): ${prodUk009.length}`);
  say(`  with ownerName populated: ${prod.filter((m) => m.ownerName).length}`);

  // Identifier realism check — decides whether a join on number is even possible.
  // Real UKIPO numbers are UK + 11 digits (e.g. UK00003187654).
  const realFormat = prod.filter((m) => /^UK\d{11}$/.test(norm(m.applicationNumber)));
  say(`  application numbers in real UKIPO format (UK+11 digits): ${realFormat.length}/${prod.length}`);
  if (realFormat.length === 0) {
    say('  ⚠ NO production application number is a real UKIPO identifier — the seeded');
    say('    portfolio is illustrative. A number-keyed diff is impossible; the only');
    say('    usable join key against real registry data is mark_text (+ owner).');
  }

  report.production = {
    gbCount: prod.length,
    uk009: prodUk009.length,
    ownerNamePopulated: prod.filter((m) => m.ownerName).length,
    realFormatIdentifiers: realFormat.length,
  };

  if (!authed) {
    say('\nNo authenticated API response — diff not performed.');
    say('When a key is available this section compares, per mark:');
    say('  status · filing/registration/expiry dates · presence of UK009 records.');
    report.diff = { performed: false, reason: 'no authenticated API response' };
    return;
  }

  // Page the portfolio.
  const all: ApiMark[] = [];
  for (let skip = 0, page = 1; ; skip += 100, page++) {
    const r = await call(`/firmportfolio?take=100&skip=${skip}`);
    if (r.status !== 200) { say(`  page ${page}: HTTP ${r.status} — stopping`); break; }
    let recs: any;
    try { recs = JSON.parse(r.body); } catch { say(`  page ${page}: unparseable JSON — stopping`); break; }
    const arr = Array.isArray(recs) ? recs : (recs.items ?? recs.results ?? recs.trademarks ?? recs.data);
    if (!Array.isArray(arr) || arr.length === 0) break;
    all.push(...arr);
    say(`  page ${page}: ${arr.length} records (total ${all.length})`);
    if (arr.length < 100) break;
    if (page > 200) { say('  safety stop at 200 pages'); break; }
  }

  const gb = all.filter(isGb);
  const apiUk009 = gb.filter((m) => norm(m.application_number).startsWith('UK009'));
  say(`\nAPI records: ${all.length} · GB: ${gb.length} · UK009-prefixed: ${apiUk009.length}`);

  // Join on mark_text — the only key that survives the identifier mismatch.
  const byText = new Map<string, ApiMark[]>();
  for (const m of gb) {
    const k = norm(m.mark_text);
    byText.set(k, [...(byText.get(k) ?? []), m]);
  }

  const diffs: any[] = [];
  for (const p of prod) {
    const matches = byText.get(norm(p.markText)) ?? [];
    if (matches.length === 0) { diffs.push({ mark: p.markText, issue: 'absent from API' }); continue; }
    for (const a of matches) {
      const d: any = { mark: p.markText, apiNumber: a.application_number };
      if (norm(a.status) !== norm(p.status)) d.status = { prod: p.status, api: a.status };
      if (iso(a.application_date) !== iso(p.filingDate)) d.filing = { prod: iso(p.filingDate), api: iso(a.application_date) };
      if (iso(a.registration_date) !== iso(p.registrationDate)) d.registration = { prod: iso(p.registrationDate), api: iso(a.registration_date) };
      if (iso(a.expiry_date) !== iso(p.expiryDate)) d.expiry = { prod: iso(p.expiryDate), api: iso(a.expiry_date) };
      if (Object.keys(d).length > 2) diffs.push(d);
    }
  }

  say(`\nMarks differing (or absent): ${diffs.length}`);
  for (const d of diffs.slice(0, 40)) say(`  ${JSON.stringify(d)}`);
  if (diffs.length > 40) say(`  … ${diffs.length - 40} more`);

  report.diff = { performed: true, apiTotal: all.length, apiGb: gb.length, apiUk009: apiUk009.length, diffs };
  report.apiSampleRecord = gb[0] ?? all[0] ?? null;
}

/* ─────────────────────────────────────────────────────────────────
 * (d) Distance from the Prisma schema.
 * ───────────────────────────────────────────────────────────────── */
const MAPPING: Array<[string, string, string]> = [
  // API field (from old script + snapshots)   Prisma target            Work
  ['mark_text',                'Trademark.markText',            'direct'],
  ['registry_name',            'Trademark.registryName',        'direct (vocabulary check: UKIPO/EUIPO/… must match ours)'],
  ['status',                   'Trademark.status',              'MAP → enum {Registered,Pending,Published,Expired,Abandoned}; registry vocab is wider (Dead/Removed/Opposed…)'],
  ['application_number',       'Trademark.applicationNumber',   'direct'],
  ['registration_number',      'Trademark.registrationNumber',  'direct'],
  ['application_date',         'Trademark.filingDate',          'RENAME + parse ISO'],
  ['registration_date',        'Trademark.registrationDate',    'direct + parse'],
  ['expiry_date',              'Trademark.expiryDate',          'direct + parse'],
  ['publication_date',         'Trademark.publicationDate',     'direct + parse'],
  ['client_agent_name',        'Trademark.clientAgentName',     'direct'],
  ['good_and_services[]',      'GoodsService[]',                'FLATTEN nested {language,search_class,text} → child rows'],
  ['good_and_services[].search_class.number', 'GoodsService.classNumber', 'unwrap 2 levels'],
  ['—',                        'Trademark.ownerName',           'NOT IN the known API shape — needs /client or owner fields'],
  ['—',                        'Trademark.ownerCountry',        'NOT IN the known API shape'],
  ['—',                        'Trademark.representativeName',  'NOT IN the known API shape'],
  ['—',                        'Trademark.companyId',           'ASSIGNED by us at import (tenant)'],
  ['—',                        'Trademark.familyId',            'DERIVED — families are explicit entities, never inferred'],
  ['—',                        'Trademark.needsData',           'COMPUTED by the deadline engine'],
  ['—',                        'Deadline[]',                    'COMPUTED by lib/renewal-rules from filing/registration'],
  ['registry_id / *_type_id',  '—',                             'DROP — LawPanel-internal ids, no BrandVault counterpart'],
  ['do_not_create_file, user_id, publication_notes', '—',       'DROP'],
];

function sectionD() {
  h('(d) API SHAPE → PRISMA SCHEMA');
  say('⚠ The field names below come from the OLD FETCH SCRIPT and the two shipped');
  say('  JSON snapshots. Both snapshots are illustrative sample data, and the login');
  say('  endpoint the script used does not exist — so this shape has NEVER been');
  say('  confirmed against a live response. Treat as unverified until (a) passes.\n');

  const w = Math.max(...MAPPING.map(([a]) => a.length));
  const w2 = Math.max(...MAPPING.map(([, b]) => b.length));
  say(`  ${'API FIELD'.padEnd(w)}  ${'PRISMA'.padEnd(w2)}  WORK`);
  for (const [a, b, c] of MAPPING) say(`  ${a.padEnd(w)}  ${b.padEnd(w2)}  ${c}`);

  const direct = MAPPING.filter(([, , c]) => c.startsWith('direct')).length;
  say('');
  say(`Direct copies: ${direct}/${MAPPING.length}. Real work is concentrated in:`);
  say('  1. status vocabulary → our 5-value enum (lossy; needs a decision per value)');
  say('  2. good_and_services → GoodsService rows (nested unwrap)');
  say('  3. owner/representative — absent from the known shape entirely');
  say('  4. families + deadlines are ours to derive, not imported');

  report.mapping = MAPPING.map(([api, prisma_, work]) => ({ api, prisma: prisma_, work }));
}

/* ── main ─────────────────────────────────────────────────────── */
(async () => {
  say(`LawPanel Firms API recon — ${BASE}`);
  say(`Subscription key: ${KEY ? 'present' : 'ABSENT (set LAWPANEL_KEY)'}`);

  const probe = await sectionA();
  const authed = probe.status === 200;
  await sectionC();
  await sectionB(authed);
  sectionD();

  h('SUMMARY');
  say(`(a) reachability : ${report.reachability && (report.reachability as any).verdict}`);
  say(`(b) diff         : ${(report.diff as any)?.performed ? `${(report.diff as any).diffs.length} differences` : 'BLOCKED — no authenticated response'}`);
  say(`(c) endpoints    : ${(report.endpoints as any[]).filter((r) => r.exists).length} operations exist`);
  say(`(d) mapping      : ${MAPPING.length} fields catalogued (shape unverified)`);

  if (JSON_OUT) console.log(JSON.stringify({ ...report, text: out }, null, 2));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('FATAL:', e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
