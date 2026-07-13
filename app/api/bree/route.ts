import { NextResponse } from 'next/server';
import { getActingCompany } from '../../../lib/authz';
import { parseBreeCommand } from '../../../lib/bree-commands';
import { answerBree } from '../../../lib/bree-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/bree — the web sidebar's query endpoint. Clerk-authenticated (not a
// public route), company-scoped via the acting company. Same read-only Bree
// capability as the Slack slash commands, via the shared BreeService. Responses
// are ephemeral to the session — nothing is persisted or synced to Slack.
export async function POST(req: Request) {
  const company = await getActingCompany(req);
  if (!company) return NextResponse.json({ error: 'No active organization' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const query = typeof body?.query === 'string' ? body.query : '';
  const answer = await answerBree(company.id, parseBreeCommand(query));
  return NextResponse.json({ answer });
}
