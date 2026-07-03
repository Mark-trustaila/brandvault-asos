import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/db';
import { serializeTrademark } from '../../../lib/serializers';
import { buildMarkData } from '../../../lib/marks';
import { getActingCompany, getRequestContext, requireReasonIfAdmin } from '../../../lib/authz';
import { writeAudit } from '../../../lib/audit';

// Hits MySQL at request time — never statically evaluated at build.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/trademarks — the active org's portfolio, in the shape the dashboard
// expects (types/trademark.ts). Empty payload when no org is active.
export async function GET(req: Request) {
  const company = await getActingCompany(req);
  const marks = company
    ? await prisma.trademark.findMany({
        where: { companyId: company.id },
        include: { goodsServices: true },
        orderBy: { markText: 'asc' },
      })
    : [];
  const trademarks = marks.map(serializeTrademark);
  return NextResponse.json({
    count: trademarks.length,
    trademarks,
    fetchedAt: new Date().toISOString(),
    source: 'database',
  });
}

// POST /api/trademarks — create a mark for the acting company (own org, or a
// target company for a platform admin via x-bv-company-id). Audited.
export async function POST(req: Request) {
  const { ctx, error: ctxErr } = await getRequestContext(req);
  if (ctxErr) return NextResponse.json({ error: ctxErr.message }, { status: ctxErr.status });

  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === 'string' ? body.reason : null;
  const reasonErr = requireReasonIfAdmin(ctx, reason);
  if (reasonErr) return NextResponse.json({ error: reasonErr }, { status: 400 });

  const { data, error } = buildMarkData(body, { partial: false });
  if (error) return NextResponse.json({ error }, { status: 400 });

  const mark = await prisma.trademark.create({
    data: { ...(data as unknown as Prisma.TrademarkUncheckedCreateInput), companyId: ctx.company.id },
    include: { goodsServices: true },
  });
  await writeAudit({
    companyId: ctx.company.id,
    userId: ctx.user.id,
    isPlatformAdmin: ctx.isPlatformAdmin,
    action: 'trademark.create',
    entityType: 'Trademark',
    entityId: mark.id,
    reason,
    detail: { markText: mark.markText, registryName: mark.registryName },
  });
  return NextResponse.json(serializeTrademark(mark), { status: 201 });
}
