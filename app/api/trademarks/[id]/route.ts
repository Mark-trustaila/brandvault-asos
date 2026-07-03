import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { serializeTrademark } from '../../../../lib/serializers';
import { buildMarkData } from '../../../../lib/marks';
import { getCurrentCompany } from '../../../../lib/tenant';
import { getRequestContext, requireReasonIfAdmin } from '../../../../lib/authz';
import { writeAudit } from '../../../../lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

// GET /api/trademarks/:id — a single mark in the active org.
export async function GET(_req: Request, { params }: Params) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: 'No active organization' }, { status: 403 });
  const mark = await prisma.trademark.findFirst({
    where: { id: params.id, companyId: company.id },
    include: { goodsServices: true },
  });
  if (!mark) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(serializeTrademark(mark));
}

// PATCH /api/trademarks/:id — update fields (scoped to the acting company). Audited.
export async function PATCH(req: Request, { params }: Params) {
  const { ctx, error: ctxErr } = await getRequestContext(req);
  if (ctxErr) return NextResponse.json({ error: ctxErr.message }, { status: ctxErr.status });

  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === 'string' ? body.reason : null;
  const reasonErr = requireReasonIfAdmin(ctx, reason);
  if (reasonErr) return NextResponse.json({ error: reasonErr }, { status: 400 });

  const { data, error } = buildMarkData(body, { partial: true });
  if (error) return NextResponse.json({ error }, { status: 400 });

  const owned = await prisma.trademark.findFirst({
    where: { id: params.id, companyId: ctx.company.id },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const mark = await prisma.trademark.update({
    where: { id: params.id },
    data,
    include: { goodsServices: true },
  });
  await writeAudit({
    companyId: ctx.company.id,
    userId: ctx.user.id,
    isPlatformAdmin: ctx.isPlatformAdmin,
    action: 'trademark.update',
    entityType: 'Trademark',
    entityId: mark.id,
    reason,
    detail: { fields: Object.keys(data) },
  });
  return NextResponse.json(serializeTrademark(mark));
}

// DELETE /api/trademarks/:id — remove a mark in the acting company (cascades). Audited.
export async function DELETE(req: Request, { params }: Params) {
  const { ctx, error: ctxErr } = await getRequestContext(req);
  if (ctxErr) return NextResponse.json({ error: ctxErr.message }, { status: ctxErr.status });

  const reason = new URL(req.url).searchParams.get('reason');
  const reasonErr = requireReasonIfAdmin(ctx, reason);
  if (reasonErr) return NextResponse.json({ error: reasonErr }, { status: 400 });

  const { count } = await prisma.trademark.deleteMany({
    where: { id: params.id, companyId: ctx.company.id },
  });
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await writeAudit({
    companyId: ctx.company.id,
    userId: ctx.user.id,
    isPlatformAdmin: ctx.isPlatformAdmin,
    action: 'trademark.delete',
    entityType: 'Trademark',
    entityId: params.id,
    reason,
  });
  return new NextResponse(null, { status: 204 });
}
