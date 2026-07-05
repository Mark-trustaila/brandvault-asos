import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/tenant';
import { isPlatformAdmin } from '../../../../lib/authz';
import { writeAudit } from '../../../../lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !(await isPlatformAdmin(user.id))) return null;
  return user;
}

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'company';

// GET /api/admin/companies — platform-admin only. All companies + mark counts.
export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Platform admin only' }, { status: 403 });

  const companies = await prisma.company.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, clerkOrgId: true, _count: { select: { trademarks: true } } },
  });
  return NextResponse.json({
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      trademarkCount: c._count.trademarks,
      linked: Boolean(c.clerkOrgId),
    })),
  });
}

// POST /api/admin/companies — platform admin creates a customer company during
// concierge onboarding (no Clerk org yet; linked on the customer's first login).
export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Platform admin only' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const company = await prisma.company.create({
    data: { name, slug: `${slugify(name)}-${Date.now().toString(36).slice(-4)}`, clerkOrgId: null },
  });
  await writeAudit({
    companyId: company.id,
    userId: user.id,
    isPlatformAdmin: true,
    action: 'company.create',
    entityType: 'Company',
    entityId: company.id,
    reason: typeof body?.reason === 'string' ? body.reason : 'concierge onboarding',
    detail: { name },
  });

  return NextResponse.json(
    { id: company.id, name: company.name, slug: company.slug, trademarkCount: 0 },
    { status: 201 }
  );
}
