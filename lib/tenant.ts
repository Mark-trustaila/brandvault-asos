import { auth, clerkClient } from '@clerk/nextjs/server';
import type { Company, User } from '@prisma/client';
import { prisma } from './db';

/**
 * Tenancy — maps the Clerk session to our data model.
 *
 *   Clerk Organization  <->  Company   (by clerkOrgId)
 *   Clerk User          <->  User      (by clerkUserId)
 *
 * Rows are synced lazily on request (upsert); no webhooks yet. The resolve*
 * helpers take ids so they're testable outside a request; getCurrent* read the
 * active org/user from the Clerk session.
 */

// Clerk default org roles are org:admin / org:member. Members can maintain
// their own data (editor); refine if custom Clerk roles are added.
function mapRole(orgRole?: string | null): 'admin' | 'editor' {
  return orgRole === 'org:admin' ? 'admin' : 'editor';
}

export async function resolveCompany(orgId: string): Promise<Company> {
  const existing = await prisma.company.findUnique({ where: { clerkOrgId: orgId } });
  if (existing) return existing;
  const org = await (await clerkClient()).organizations.getOrganization({ organizationId: orgId });
  return prisma.company.upsert({
    where: { clerkOrgId: orgId },
    update: {},
    create: { name: org.name, slug: org.slug ?? orgId, clerkOrgId: orgId },
  });
}

export async function resolveUser(
  clerkUserId: string,
  companyId: string,
  orgRole?: string | null
): Promise<User> {
  const role = mapRole(orgRole);
  const existing = await prisma.user.findUnique({ where: { clerkUserId } });
  if (existing) {
    if (existing.role !== role || existing.companyId !== companyId) {
      return prisma.user.update({ where: { id: existing.id }, data: { role, companyId } });
    }
    return existing;
  }
  const cu = await (await clerkClient()).users.getUser(clerkUserId);
  const email =
    cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)?.emailAddress ??
    cu.emailAddresses[0]?.emailAddress ??
    `${clerkUserId}@unknown.local`;
  const name = [cu.firstName, cu.lastName].filter(Boolean).join(' ') || email;
  return prisma.user.upsert({
    where: { clerkUserId },
    update: { role, companyId },
    create: { clerkUserId, email, name, role, companyId },
  });
}

/** The active org's Company for this request, or null if no org is active. */
export async function getCurrentCompany(): Promise<Company | null> {
  const { orgId } = await auth();
  if (!orgId) return null;
  return resolveCompany(orgId);
}

/** The current user synced into the active org's company, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) return null;
  const company = await resolveCompany(orgId);
  return resolveUser(userId, company.id, orgRole);
}
