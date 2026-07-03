/**
 * Add a second demo company ("Contoso Ltd") so the platform-admin cross-tenant
 * switcher has somewhere to switch to. Placeholder clerkOrgId — not loginnable,
 * but a platform admin can act on it cross-tenant. Idempotent.
 *   npx tsx scripts/add-demo-company.ts
 */
import { prisma, } from '../lib/db';
import type { MarkStatus } from '@prisma/client';

const SLUG = 'contoso-ltd';

async function main() {
  await prisma.company.deleteMany({ where: { slug: SLUG } });
  const company = await prisma.company.create({
    data: { name: 'Contoso Ltd', slug: SLUG, clerkOrgId: 'demo-org-contoso' },
  });

  const marks: Array<{
    registryName: string; markText: string; status: MarkStatus;
    applicationNumber: string; registrationNumber?: string;
    filingDate: Date; registrationDate?: Date; expiryDate?: Date;
  }> = [
    { registryName: 'UKIPO', markText: 'CONTOSO', status: 'Registered', applicationNumber: 'UK5000001', registrationNumber: 'UKR5000001', filingDate: new Date('2015-01-10'), registrationDate: new Date('2015-08-01'), expiryDate: new Date('2025-08-01') },
    { registryName: 'EUIPO', markText: 'CONTOSO', status: 'Registered', applicationNumber: 'EU5000002', registrationNumber: 'EUR5000002', filingDate: new Date('2016-03-05'), registrationDate: new Date('2016-11-20'), expiryDate: new Date('2026-11-20') },
    { registryName: 'USPTO', markText: 'CONTOSO CLOUD', status: 'Pending', applicationNumber: 'US5000003', filingDate: new Date('2024-02-15') },
  ];

  for (const m of marks) {
    await prisma.trademark.create({
      data: {
        ...m,
        companyId: company.id,
        goodsServices: { create: [{ classNumber: 9, text: 'Computer software' }] },
      },
    });
  }
  console.log(`Seeded ${company.name} (${SLUG}) with ${marks.length} marks`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
