import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { getRequestContext } from '../../../../../lib/authz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

// POST /api/notifications/:id/read — mark a notification read for the current
// user (idempotent). Company-scoped: only marks notifications in the user's own
// company. Called when a thread item is opened.
export async function POST(req: Request, { params }: Params) {
  const { ctx, error } = await getRequestContext(req);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const owned = await prisma.notification.findFirst({
    where: { id: params.id, companyId: ctx.company.id },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.notificationRead.upsert({
    where: { notificationId_userId: { notificationId: params.id, userId: ctx.user.id } },
    create: { notificationId: params.id, userId: ctx.user.id },
    update: {},
  });
  return NextResponse.json({ ok: true });
}
