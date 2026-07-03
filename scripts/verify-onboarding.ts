/**
 * Throwaway verification for Phase 2 onboarding (company creation + bulk entry).
 *   npx tsx scripts/verify-onboarding.ts
 */
import { prisma } from '../lib/db';
import { buildMarkData } from '../lib/marks';
import type { Prisma } from '@prisma/client';

async function main() {
  // 1. Company with NULL clerkOrgId (the nullable migration) — admin-created pre-onboarding.
  const company = await prisma.company.create({
    data: { name: 'Verify Co', slug: `verify-co-${Date.now().toString(36).slice(-4)}`, clerkOrgId: null },
  });
  console.log(`company created — clerkOrgId: ${company.clerkOrgId} (expect null)`);

  // 2. Bulk create: one valid, two invalid (bad status, missing markText).
  const rows = [
    { markText: 'ALPHA', registryName: 'UKIPO', status: 'Registered' },
    { markText: 'BETA', registryName: 'EUIPO', status: 'Bogus' },
    { registryName: 'USPTO', status: 'Pending' },
  ];
  let created = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const { data, error } = buildMarkData(rows[i], { partial: false });
    if (error) {
      errors.push(`row ${i}: ${error}`);
      continue;
    }
    await prisma.trademark.create({
      data: { ...(data as unknown as Prisma.TrademarkUncheckedCreateInput), companyId: company.id },
    });
    created += 1;
  }
  console.log(`bulk — created ${created} (expect 1), rejected ${errors.length} (expect 2)`);
  errors.forEach((e) => console.log(`  ${e}`));

  const count = await prisma.trademark.count({ where: { companyId: company.id } });
  console.log(`company mark count: ${count} (expect 1)`);

  await prisma.company.delete({ where: { id: company.id } });
  console.log('cleaned up');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
