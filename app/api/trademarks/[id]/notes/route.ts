import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { serializeNote } from '../../../../../lib/serializers';
import { getActingCompany, getRequestContext } from '../../../../../lib/authz';
import { writeAudit } from '../../../../../lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

async function ownsMark(trademarkId: string, companyId: string): Promise<boolean> {
  const m = await prisma.trademark.findFirst({
    where: { id: trademarkId, companyId },
    select: { id: true },
  });
  return Boolean(m);
}

// GET /api/trademarks/:id/notes — notes for a mark in the active org, newest first.
export async function GET(req: Request, { params }: Params) {
  const company = await getActingCompany(req);
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

// POST /api/trademarks/:id/notes — add a note by the acting user. Audited.
// A note's text is its own record, so no separate reason is required.
export async function POST(req: Request, { params }: Params) {
  const { ctx, error: ctxErr } = await getRequestContext(req);
  if (ctxErr) return NextResponse.json({ error: ctxErr.message }, { status: ctxErr.status });
  if (!(await ownsMark(params.id, ctx.company.id))) {
    return NextResponse.json({ error: 'Trademark not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

  const note = await prisma.note.create({
    data: {
      trademarkId: params.id,
      userId: ctx.user.id,
      text,
      html: typeof body?.html === 'string' ? body.html : null,
      link: typeof body?.link === 'string' && body.link ? body.link : null,
    },
    include: { user: true },
  });
  await writeAudit({
    companyId: ctx.company.id,
    userId: ctx.user.id,
    isPlatformAdmin: ctx.isPlatformAdmin,
    action: 'note.create',
    entityType: 'Note',
    entityId: note.id,
    detail: { trademarkId: params.id },
  });
  return NextResponse.json(serializeNote(note), { status: 201 });
}
