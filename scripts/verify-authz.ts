/**
 * Throwaway verification for platform-admin + audit (Phase 1 step 4).
 *   npx tsx scripts/verify-authz.ts
 */
import { prisma } from '../lib/db';
import { isPlatformAdmin, requireReasonIfAdmin } from '../lib/authz';
import { writeAudit } from '../lib/audit';
import { serializeAudit } from '../lib/serializers';

async function main() {
  const admin = await prisma.user.findFirst({ where: { email: 'mkw@mkwassoc.co.uk' } });
  const customer = await prisma.user.findFirst({ where: { email: 'mark@lawpanel.com' } });
  if (!admin || !customer) throw new Error('expected demo users missing (run db:seed + login)');

  console.log('isPlatformAdmin(admin)    ->', await isPlatformAdmin(admin.id), '(expect true)');
  console.log('isPlatformAdmin(customer) ->', await isPlatformAdmin(customer.id), '(expect false)');

  const adminCtx = { isPlatformAdmin: true } as never;
  const custCtx = { isPlatformAdmin: false } as never;
  console.log('reason admin+none   ->', requireReasonIfAdmin(adminCtx, null), '(expect error)');
  console.log('reason admin+given  ->', requireReasonIfAdmin(adminCtx, 'onboarding fix'), '(expect null)');
  console.log('reason customer     ->', requireReasonIfAdmin(custCtx, null), '(expect null)');

  const company = await prisma.company.findFirstOrThrow({ where: { slug: 'asos-plc' } });
  const a1 = await writeAudit({
    companyId: company.id, userId: admin.id, isPlatformAdmin: true,
    action: 'trademark.update', entityType: 'Trademark', entityId: 'demo-1',
    reason: 'fix registration date', detail: { fields: ['registrationDate'] },
  });
  const a2 = await writeAudit({
    companyId: company.id, userId: customer.id, isPlatformAdmin: false,
    action: 'note.create', entityType: 'Note', entityId: 'demo-2',
  });
  const rows = await prisma.auditLog.findMany({
    where: { id: { in: [a1.id, a2.id] } }, include: { user: true }, orderBy: { createdAt: 'asc' },
  });
  for (const r of rows) {
    const s = serializeAudit(r);
    console.log(`audit: ${s.action} | actor=${s.actor} | reason=${s.reason ?? '-'} | admin=${s.isPlatformAdmin}`);
  }

  await prisma.auditLog.deleteMany({ where: { id: { in: [a1.id, a2.id] } } });
  console.log('cleaned up demo audit rows');
}

main()
  .catch((e) => { console.error('FAILED:', e.message ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
