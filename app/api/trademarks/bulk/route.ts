import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../lib/db';
import { serializeTrademark } from '../../../../lib/serializers';
import { buildMarkData } from '../../../../lib/marks';
import { getRequestContext, requireReasonIfAdmin } from '../../../../lib/authz';
import { writeAudit } from '../../../../lib/audit';
import { recalcDeadlines } from '../../../../lib/deadlines';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/trademarks/bulk — create many marks at once for the acting company
// (concierge bulk entry). Valid rows are created; invalid rows are reported by
// index so the client can fix and resubmit just those. Each creation is audited.
export async function POST(req: Request) {
  const { ctx, error: ctxErr } = await getRequestContext(req);
  if (ctxErr) return NextResponse.json({ error: ctxErr.message }, { status: ctxErr.status });

  const body = await req.json().catch(() => null);
  const rows: unknown[] = Array.isArray(body?.marks) ? body.marks : [];
  if (rows.length === 0) return NextResponse.json({ error: 'marks[] is required' }, { status: 400 });

  const reason = typeof body?.reason === 'string' ? body.reason : null;
  const reasonErr = requireReasonIfAdmin(ctx, reason);
  if (reasonErr) return NextResponse.json({ error: reasonErr }, { status: 400 });

  const created: ReturnType<typeof serializeTrademark>[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const { data, error } = buildMarkData(rows[i], { partial: false });
    if (error) {
      errors.push({ index: i, error });
      continue;
    }
    const mark = await prisma.trademark.create({
      data: { ...(data as unknown as Prisma.TrademarkUncheckedCreateInput), companyId: ctx.company.id },
      include: { goodsServices: true },
    });
    mark.needsData = (await recalcDeadlines(mark)).needsData;
    created.push(serializeTrademark(mark));
    await writeAudit({
      companyId: ctx.company.id,
      userId: ctx.user.id,
      isPlatformAdmin: ctx.isPlatformAdmin,
      action: 'trademark.create',
      entityType: 'Trademark',
      entityId: mark.id,
      reason,
      detail: { markText: mark.markText, registryName: mark.registryName, bulk: true },
    });
  }

  return NextResponse.json({ createdCount: created.length, created, errors }, { status: 201 });
}
