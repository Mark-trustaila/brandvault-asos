import { auth } from '@clerk/nextjs/server';
import type { Company, User } from '@prisma/client';
import { prisma } from './db';
import { resolveCompany, resolveUser } from './tenant';

export type RequestContext = {
  user: User;
  company: Company; // the company being acted on
  isPlatformAdmin: boolean;
  crossTenant: boolean; // platform admin acting outside their own org
};

export type ContextError = { status: number; message: string };

// Platform admins may target a company other than their active org by passing
// its id in this header (cross-tenant access for onboarding / data correction).
const COMPANY_HEADER = 'x-bv-company-id';

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  return Boolean(await prisma.platformAdmin.findUnique({ where: { userId } }));
}

/**
 * Resolve who is acting and on which company for a write request.
 * - Normal users act on their active org's company.
 * - Platform admins may act cross-tenant via the x-bv-company-id header.
 * - A non-admin sending that header (for another company) is denied.
 */
export async function getRequestContext(
  req: Request
): Promise<{ ctx: RequestContext; error?: undefined } | { ctx?: undefined; error: ContextError }> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) return { error: { status: 403, message: 'No active organization' } };

  const homeCompany = await resolveCompany(orgId);
  const user = await resolveUser(userId, homeCompany.id, orgRole);
  const platformAdmin = await isPlatformAdmin(user.id);

  const targetId = req.headers.get(COMPANY_HEADER);
  if (targetId && targetId !== homeCompany.id) {
    if (!platformAdmin) return { error: { status: 403, message: 'Cross-tenant access denied' } };
    const target = await prisma.company.findUnique({ where: { id: targetId } });
    if (!target) return { error: { status: 404, message: 'Target company not found' } };
    return { ctx: { user, company: target, isPlatformAdmin: true, crossTenant: true } };
  }

  return { ctx: { user, company: homeCompany, isPlatformAdmin: platformAdmin, crossTenant: false } };
}

/** Platform-admin writes must carry a reason (audited). Returns an error string if invalid. */
export function requireReasonIfAdmin(ctx: RequestContext, reason: string | null): string | null {
  if (ctx.isPlatformAdmin && !reason) {
    return 'A reason is required for platform-admin edits';
  }
  return null;
}
