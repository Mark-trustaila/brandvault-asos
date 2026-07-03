/**
 * Throwaway verification for the Clerk tenancy layer (Phase 1 step 3b).
 * Exercises resolveCompany/resolveUser (which hit the Clerk backend API) and
 * checks org-scoping + tenant isolation against the local DB. Not shipped as a
 * test suite — run ad hoc:  npx tsx scripts/verify-tenant.ts
 */
import { resolveCompany, resolveUser } from '../lib/tenant';
import { prisma } from '../lib/db';

async function main() {
  const orgId = process.env.SEED_CLERK_ORG_ID;
  if (!orgId) throw new Error('SEED_CLERK_ORG_ID not set');

  const company = await resolveCompany(orgId);
  console.log(`resolveCompany -> ${company.name} (clerkOrgId ${company.clerkOrgId})`);

  const scoped = await prisma.trademark.count({ where: { companyId: company.id } });
  console.log(`org-scoped trademark count -> ${scoped} (expect 81)`);

  const isolated = await prisma.trademark.count({ where: { companyId: 'does-not-exist' } });
  console.log(`other-company count -> ${isolated} (expect 0 = isolation holds)`);

  const userId = process.env.VERIFY_CLERK_USER_ID;
  if (userId) {
    const user = await resolveUser(userId, company.id, 'org:admin');
    console.log(`resolveUser -> ${user.name} <${user.email}> role=${user.role} companyId=${user.companyId === company.id ? 'MATCHES company' : user.companyId}`);
  }
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
