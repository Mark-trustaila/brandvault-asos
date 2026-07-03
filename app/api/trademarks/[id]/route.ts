import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { serializeTrademark } from '../../../../lib/serializers';
import { buildMarkData } from '../../../../lib/marks';
import { getCurrentCompany } from '../../../../lib/tenant';

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

// PATCH /api/trademarks/:id — update the provided fields (scoped to the org).
export async function PATCH(req: Request, { params }: Params) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: 'No active organization' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { data, error } = buildMarkData(body, { partial: true });
  if (error) return NextResponse.json({ error }, { status: 400 });

  const owned = await prisma.trademark.findFirst({
    where: { id: params.id, companyId: company.id },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const mark = await prisma.trademark.update({
    where: { id: params.id },
    data,
    include: { goodsServices: true },
  });
  return NextResponse.json(serializeTrademark(mark));
}

// DELETE /api/trademarks/:id — remove a mark in the active org (cascades).
export async function DELETE(_req: Request, { params }: Params) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: 'No active organization' }, { status: 403 });
  const { count } = await prisma.trademark.deleteMany({
    where: { id: params.id, companyId: company.id },
  });
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
