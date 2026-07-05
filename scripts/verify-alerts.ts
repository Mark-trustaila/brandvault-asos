/**
 * Dry-run verification for the Bree alert engine against the seeded local DB.
 * Exercises the slash-command queries and the daily-alert selection logic —
 * NO Slack calls are made (it never sends; it only reports what *would* fire).
 *
 *   npx tsx scripts/verify-alerts.ts
 */
import { prisma } from '../lib/db';
import { alertBucket, daysUntil, DEFAULT_THRESHOLDS } from '../lib/alerts';
import { portfolioSummary, upcomingRenewals, markStatus } from '../lib/bree-queries';
import { parseBreeCommand } from '../lib/bree-commands';

async function main() {
  const now = new Date();
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!company) {
    console.log('No company in the local DB — run the seed first.');
    return;
  }
  console.log(`Company: ${company.name} (${company.id})\n`);

  // 1. Slash-command queries
  console.log('== /bree portfolio ==');
  console.log(await portfolioSummary(company.id, now));

  console.log('\n== /bree renewals (next 5) ==');
  for (const r of await upcomingRenewals(company.id, 5, now)) {
    console.log(`  ${r.markText} (${r.registry}) — ${r.daysRemaining}d · ${r.dueDate}`);
  }

  console.log('\n== /bree status <first mark> ==');
  const first = await prisma.trademark.findFirst({ where: { companyId: company.id }, orderBy: { markText: 'asc' } });
  if (first) {
    console.log(`  parse -> `, parseBreeCommand(`status ${first.markText}`));
    console.log(`  result -> `, await markStatus(company.id, first.markText, now));
  }

  // 2. Daily-alert selection (dry run) — how many deadlines sit in each bucket
  const thresholds = DEFAULT_THRESHOLDS.slice().sort((a, b) => b - a);
  const deadlines = await prisma.deadline.findMany({
    where: { trademark: { companyId: company.id }, dueDate: { gte: now } },
    include: { trademark: true },
    orderBy: { dueDate: 'asc' },
  });
  const buckets: Record<number, number> = { [-1]: 0, 0: 0, 1: 0, 2: 0 };
  const wouldAlert: string[] = [];
  const flags = ['alert180Sent', 'alert90Sent', 'alert30Sent'] as const;
  for (const d of deadlines) {
    const b = alertBucket(daysUntil(d.dueDate, now), thresholds);
    buckets[b] = (buckets[b] ?? 0) + 1;
    if (b >= 0 && !(d as Record<string, unknown>)[flags[b]]) {
      wouldAlert.push(`  ${d.trademark.markText} — ${d.type} in ${daysUntil(d.dueDate, now)}d (threshold ${thresholds[b]})`);
    }
  }
  console.log(`\n== Daily-alert dry run (thresholds ${thresholds.join('/')}) ==`);
  console.log(`  upcoming deadlines: ${deadlines.length}`);
  console.log(`  bucket 180: ${buckets[0]}  bucket 90: ${buckets[1]}  bucket 30: ${buckets[2]}  beyond: ${buckets[-1]}`);
  console.log(`  would send now (${wouldAlert.length}):`);
  wouldAlert.slice(0, 15).forEach((l) => console.log(l));
  if (wouldAlert.length > 15) console.log(`  … and ${wouldAlert.length - 15} more`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
