import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { getRequestContext } from '../../../lib/authz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/notifications — the acting company's Bree notifications, newest first,
// with per-user read state and an unread count. Backs the Bree panel's threads
// bar + unread indicator. Company-scoped via the request context.
export async function GET(req: Request) {
  const { ctx, error } = await getRequestContext(req);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const rows = await prisma.notification.findMany({
    where: { companyId: ctx.company.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      trademark: { select: { id: true, markText: true, registryName: true } },
      reads: { where: { userId: ctx.user.id }, select: { id: true } },
    },
  });

  const unread = await prisma.notification.count({
    where: { companyId: ctx.company.id, reads: { none: { userId: ctx.user.id } } },
  });

  return NextResponse.json({
    unread,
    items: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      trademark: n.trademark,
      createdAt: n.createdAt.toISOString(),
      read: n.reads.length > 0,
    })),
  });
}
