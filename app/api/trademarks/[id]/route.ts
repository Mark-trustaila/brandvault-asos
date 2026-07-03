import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../lib/db';
import { serializeTrademark } from '../../../../lib/serializers';
import { buildMarkData } from '../../../../lib/marks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

// GET /api/trademarks/:id — a single mark.
export async function GET(_req: Request, { params }: Params) {
  const mark = await prisma.trademark.findUnique({
    where: { id: params.id },
    include: { goodsServices: true },
  });
  if (!mark) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(serializeTrademark(mark));
}

// PATCH /api/trademarks/:id — update the provided fields only.
export async function PATCH(req: Request, { params }: Params) {
  const body = await req.json().catch(() => null);
  const { data, error } = buildMarkData(body, { partial: true });
  if (error) return NextResponse.json({ error }, { status: 400 });

  try {
    const mark = await prisma.trademark.update({
      where: { id: params.id },
      data,
      include: { goodsServices: true },
    });
    return NextResponse.json(serializeTrademark(mark));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    throw e;
  }
}

// DELETE /api/trademarks/:id — remove a mark (cascades to goods, notes, deadlines).
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await prisma.trademark.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    throw e;
  }
}
