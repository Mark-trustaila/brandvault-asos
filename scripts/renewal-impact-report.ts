/**
 * Read-only: which marks get a different renewal date under the new
 * config-driven engine (correct term_from) vs the old logic (always
 * registration + 10 years). For spot-checking after the term_from change.
 *   npx tsx scripts/renewal-impact-report.ts
 */
import { prisma } from '../lib/db';
import { computeRenewalDate } from '../lib/renewal-rules';

const oldRenewal = (reg: Date | null): string => {
  if (!reg) return '';
  const d = new Date(reg);
  d.setUTCFullYear(d.getUTCFullYear() + 10); // legacy: always registration + 10y
  return d.toISOString().slice(0, 10);
};

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

async function main() {
  const marks = await prisma.trademark.findMany({
    include: { company: true },
    orderBy: [{ registryName: 'asc' }, { markText: 'asc' }],
  });

  const rows = marks.map((m) => {
    const oldR = oldRenewal(m.registrationDate);
    const newR = computeRenewalDate(m.registryName, iso(m.filingDate), iso(m.registrationDate));
    const delta = oldR && newR ? Math.round((+new Date(newR) - +new Date(oldR)) / 86_400_000) : null;
    return { company: m.company.name, registry: m.registryName, mark: m.markText, filing: iso(m.filingDate), reg: iso(m.registrationDate), oldR, newR, delta };
  });

  const changed = rows.filter((r) => r.oldR !== r.newR);
  console.log(`# Renewal term_from impact\n`);
  console.log(`${marks.length} marks total; ${changed.length} get a different renewal date under the new engine.\n`);

  // by registry
  const byReg: Record<string, number> = {};
  for (const r of changed) byReg[r.registry] = (byReg[r.registry] ?? 0) + 1;
  console.log('## Changed, by registry');
  for (const [reg, n] of Object.entries(byReg).sort()) console.log(`- ${reg}: ${n}`);

  console.log('\n## Sample of changed marks (first 25)');
  console.log('| Company | Registry | Mark | Filing | Reg | Old renewal | New renewal | Δ days |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of changed.slice(0, 25)) {
    console.log(`| ${r.company} | ${r.registry} | ${r.mark} | ${r.filing || '—'} | ${r.reg || '—'} | ${r.oldR || '—'} | ${r.newR || '—'} | ${r.delta ?? '—'} |`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
