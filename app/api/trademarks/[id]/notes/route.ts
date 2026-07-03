import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { serializeNote } from '../../../../../lib/serializers';
import { getCurrentCompany, getCurrentUser } from '../../../../../lib/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

// Confirm the mark exists AND belongs to the active org.
async function ownsMark(trademarkId: string, companyId: string): Promise<boolean> {
  const m = await prisma.trademark.findFirst({
    where: { id: trademarkId, companyId },
    select: { id: true },
  });
  return Boolean(m);
}

// GET /api/trademarks/:id/notes — notes for a mark in the active org, newest first.
export async function GET(_req: Request, { params }: Params) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: 'No active organization' }, { status: 403 });
  if (!(await ownsMark(params.id, company.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const notes = await prisma.note.findMany({
    where: { trademarkId: params.id },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(notes.map(serializeNote));
}

// POST /api/trademarks/:id/notes — add a note authored by the current user.
export async function POST(req: Request, { params }: Params) {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ error: 'No active organization' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No user context' }, { status: 403 });
  if (!(await ownsMark(params.id, company.id))) {
    return NextResponse.json({ error: 'Trademark not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

  const note = await prisma.note.create({
    data: {
      trademarkId: params.id,
      userId: user.id,
      text,
      html: typeof body?.html === 'string' ? body.html : null,
      link: typeof body?.link === 'string' && body.link ? body.link : null,
    },
    include: { user: true },
  });
  return NextResponse.json(serializeNote(note), { status: 201 });
}
