import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getRequestContext } from '../../../../lib/authz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

// GET /api/notifications/:id — a single notification, company-scoped. Backs the
// deep link (/?notification=:id). 404 if it isn't the user's company's — so a
// deep link can't leak another tenant's notification.
export async function GET(req: Request, { params }: Params) {
  const { ctx, error } = await getRequestContext(req);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const n = await prisma.notification.findFirst({
    where: { id: params.id, companyId: ctx.company.id },
    include: { trademark: { select: { id: true, markText: true, registryName: true } } },
  });
  if (!n) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    notification: {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      trademark: n.trademark,
      createdAt: n.createdAt.toISOString(),
    },
  });
}
