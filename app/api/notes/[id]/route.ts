import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getCurrentCompany } from '../../../../lib/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

// DELETE /api/notes/:id — remove a note, only if its mark is in the active org.
export async function DELETE(_req: Request, { params }: Params) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: 'No active organization' }, { status: 403 });
  const { count } = await prisma.note.deleteMany({
    where: { id: params.id, trademark: { companyId: company.id } },
  });
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
