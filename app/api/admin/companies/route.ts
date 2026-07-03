import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/tenant';
import { isPlatformAdmin } from '../../../../lib/authz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/admin/companies — platform-admin only. Lists every company (with a
// mark count) so an admin can pick a cross-tenant target for onboarding /
// data correction (sent back as the x-bv-company-id header on writes).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isPlatformAdmin(user.id))) {
    return NextResponse.json({ error: 'Platform admin only' }, { status: 403 });
  }

  const companies = await prisma.company.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, _count: { select: { trademarks: true } } },
  });

  return NextResponse.json({
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      trademarkCount: c._count.trademarks,
    })),
  });
}
