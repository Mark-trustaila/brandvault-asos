import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { getActingCompany, getRequestContext } from '../../../lib/authz';
import { writeAudit } from '../../../lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/families — the acting company's trademark families (for assignment).
export async function GET(req: Request) {
  const company = await getActingCompany(req);
  if (!company) return NextResponse.json({ families: [] });
  const families = await prisma.trademarkFamily.findMany({
    where: { companyId: company.id },
    orderBy: { familyName: 'asc' },
    select: { id: true, familyName: true, _count: { select: { trademarks: true } } },
  });
  return NextResponse.json({
    families: families.map((f) => ({ id: f.id, name: f.familyName, markCount: f._count.trademarks })),
  });
}

// POST /api/families — create a family for the acting company (explicit entity,
// never inferred from mark_text). Audited.
export async function POST(req: Request) {
  const { ctx, error: ctxErr } = await getRequestContext(req);
  if (ctxErr) return NextResponse.json({ error: ctxErr.message }, { status: ctxErr.status });

  const body = await req.json().catch(() => null);
  const name = typeof body?.familyName === 'string' ? body.familyName.trim() : '';
  if (!name) return NextResponse.json({ error: 'familyName is required' }, { status: 400 });

  const family = await prisma.trademarkFamily.create({
    data: { companyId: ctx.company.id, familyName: name },
  });
  await writeAudit({
    companyId: ctx.company.id,
    userId: ctx.user.id,
    isPlatformAdmin: ctx.isPlatformAdmin,
    action: 'family.create',
    entityType: 'TrademarkFamily',
    entityId: family.id,
    reason: typeof body?.reason === 'string' ? body.reason : null,
    detail: { name },
  });
  return NextResponse.json({ id: family.id, name: family.familyName, markCount: 0 }, { status: 201 });
}
