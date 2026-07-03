import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { serializeNote } from '../../../../../lib/serializers';
import { getCurrentUser } from '../../../../../lib/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

// GET /api/trademarks/:id/notes — notes for a mark, newest first.
export async function GET(_req: Request, { params }: Params) {
  const notes = await prisma.note.findMany({
    where: { trademarkId: params.id },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(notes.map(serializeNote));
}

// POST /api/trademarks/:id/notes — add a note authored by the current user.
// `text` carries the composer's sanitised HTML (see serializeNote).
export async function POST(req: Request, { params }: Params) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No user context' }, { status: 400 });

  const mark = await prisma.trademark.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!mark) return NextResponse.json({ error: 'Trademark not found' }, { status: 404 });

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
