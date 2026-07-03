import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/db';
import { serializeTrademark } from '../../../lib/serializers';
import { buildMarkData } from '../../../lib/marks';
import { getCurrentCompany } from '../../../lib/tenant';

// Hits MySQL at request time — never statically evaluated at build.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/trademarks — the current company's portfolio, in the shape the
// dashboard expects (types/trademark.ts). No tenant filtering yet — added with
// Clerk auth in Phase 1 step 3.
export async function GET() {
  const marks = await prisma.trademark.findMany({
    include: { goodsServices: true },
    orderBy: { markText: 'asc' },
  });
  const trademarks = marks.map(serializeTrademark);
  return NextResponse.json({
    count: trademarks.length,
    trademarks,
    fetchedAt: new Date().toISOString(),
    source: 'database',
  });
}

// POST /api/trademarks — create a mark for the current company.
export async function POST(req: Request) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: 'No company context' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const { data, error } = buildMarkData(body, { partial: false });
  if (error) return NextResponse.json({ error }, { status: 400 });

  const mark = await prisma.trademark.create({
    data: { ...(data as unknown as Prisma.TrademarkUncheckedCreateInput), companyId: company.id },
    include: { goodsServices: true },
  });
  return NextResponse.json(serializeTrademark(mark), { status: 201 });
}
