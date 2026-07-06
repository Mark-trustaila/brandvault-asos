import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { getRequestContext, requireReasonIfAdmin } from '../../../../../lib/authz';
import { writeAudit } from '../../../../../lib/audit';
import { COMMUNICATION_TYPES, REGISTRIES } from '../../../../../lib/email-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

// PATCH /api/email/inbox/:id — human review of a Bree classification.
//   { action: 'confirm' | 'correct' | 'dismiss', correction?, reason? }
// confirm  → accept Bree's classification as-is
// correct  → record the human's corrected {registry, communicationType, matchedTrademarkId}
// dismiss  → drop it from the queues
// Corrections are kept alongside Bree's original (which stays in
// classificationJson) so they can seed the harness corpus as labelled examples.
export async function PATCH(req: Request, { params }: Params) {
  const { ctx, error } = await getRequestContext(req);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });
  if (ctx.user.role === 'viewer') return NextResponse.json({ error: 'Viewers cannot review inbound email' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const action = body?.action as 'confirm' | 'correct' | 'dismiss' | undefined;
  if (!action || !['confirm', 'correct', 'dismiss'].includes(action)) {
    return NextResponse.json({ error: 'action must be confirm | correct | dismiss' }, { status: 400 });
  }
  const reason = typeof body?.reason === 'string' ? body.reason : null;
  const reasonErr = requireReasonIfAdmin(ctx, reason);
  if (reasonErr) return NextResponse.json({ error: reasonErr }, { status: 400 });

  const email = await prisma.inboundEmail.findFirst({
    where: { id: params.id, companyId: ctx.company.id },
    select: { id: true, classificationJson: true },
  });
  if (!email) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const base = { reviewedByUserId: ctx.user.id, reviewedAt: new Date() };
  let data: Record<string, unknown>;

  if (action === 'dismiss') {
    data = { ...base, status: 'dismissed' };
  } else if (action === 'confirm') {
    // Accept Bree's classification; keep it as the reviewed label too.
    data = { ...base, status: 'processed', reviewClassificationJson: email.classificationJson ?? undefined };
  } else {
    // correct
    const corr = body?.correction ?? {};
    if (corr.registry && !REGISTRIES.includes(corr.registry)) return NextResponse.json({ error: 'invalid registry' }, { status: 400 });
    if (corr.communicationType && !COMMUNICATION_TYPES.includes(corr.communicationType)) return NextResponse.json({ error: 'invalid communicationType' }, { status: 400 });
    let matchedTrademarkId: string | null | undefined = undefined;
    if (typeof corr.matchedTrademarkId === 'string') {
      const owned = await prisma.trademark.findFirst({ where: { id: corr.matchedTrademarkId, companyId: ctx.company.id }, select: { id: true } });
      if (!owned) return NextResponse.json({ error: 'matchedTrademarkId not in this company' }, { status: 400 });
      matchedTrademarkId = owned.id;
    } else if (corr.matchedTrademarkId === null) {
      matchedTrademarkId = null;
    }
    data = {
      ...base,
      status: 'processed',
      reviewClassificationJson: {
        registry: corr.registry ?? null,
        communicationType: corr.communicationType ?? null,
        matchedTrademarkId: matchedTrademarkId ?? null,
        note: typeof corr.note === 'string' ? corr.note : undefined,
      },
      ...(matchedTrademarkId !== undefined ? { matchedTrademarkId } : {}),
    };
  }

  await prisma.inboundEmail.update({ where: { id: params.id }, data });
  await writeAudit({
    companyId: ctx.company.id,
    userId: ctx.user.id,
    isPlatformAdmin: ctx.isPlatformAdmin,
    action: `inbound.${action}`,
    entityType: 'InboundEmail',
    entityId: params.id,
    reason,
    detail: action === 'correct' ? (data.reviewClassificationJson as object) : undefined,
  });

  return NextResponse.json({ ok: true, id: params.id, action });
}
