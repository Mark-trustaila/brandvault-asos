import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getRequestContext } from '../../../../lib/authz';
import { writeAudit } from '../../../../lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

// DELETE /api/notes/:id — remove a note, only if its mark is in the acting
// company (own org, or a target company for a platform admin). Audited.
export async function DELETE(req: Request, { params }: Params) {
  const { ctx, error: ctxErr } = await getRequestContext(req);
  if (ctxErr) return NextResponse.json({ error: ctxErr.message }, { status: ctxErr.status });

  const { count } = await prisma.note.deleteMany({
    where: { id: params.id, trademark: { companyId: ctx.company.id } },
  });
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await writeAudit({
    companyId: ctx.company.id,
    userId: ctx.user.id,
    isPlatformAdmin: ctx.isPlatformAdmin,
    action: 'note.delete',
    entityType: 'Note',
    entityId: params.id,
  });
  return new NextResponse(null, { status: 204 });
}
