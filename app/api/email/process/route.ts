import { NextResponse } from 'next/server';
import { processPending } from '../../../../lib/email-processor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

// POST /api/email/process — process pending InboundEmails on demand (testing).
// CRON_SECRET-guarded (Authorization: Bearer <secret>). Optional JSON body
// { companyId?, limit? } to scope the batch. The route is under /api/email/*,
// already public in middleware; the secret is its real gate.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const results = await processPending({ companyId: body?.companyId, limit: body?.limit });
  const summary = results.reduce<Record<string, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
  return NextResponse.json({ ok: true, processed: results.length, summary, results });
}
