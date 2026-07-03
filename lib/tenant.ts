import { prisma } from './db';

/**
 * Placeholder tenancy — until Clerk auth lands (Phase 1 step 3).
 *
 * The product is single-tenant right now: everything resolves to the seeded
 * "ASOS plc" company and its admin user. When Clerk is wired, these two
 * functions become the single place that reads the authenticated org/user from
 * the session instead of hard-resolving the demo tenant.
 */
const DEMO_COMPANY_SLUG = 'asos-plc';

export function getCurrentCompany() {
  return prisma.company.findFirst({ where: { slug: DEMO_COMPANY_SLUG } });
}

export async function getCurrentUser() {
  const company = await getCurrentCompany();
  if (!company) return null;
  return prisma.user.findFirst({ where: { companyId: company.id } });
}
