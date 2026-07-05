import { NextResponse } from 'next/server';
import { runDailyAlerts } from '../../../../lib/alerts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Long-running sweep across all companies — allow up to 5 min on Vercel.
export const maxDuration = 300;

// GET /api/cron/alerts — the daily Vercel Cron entry point. Protected by
// CRON_SECRET when set (Vercel sends it as `Authorization: Bearer <secret>`).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const result = await runDailyAlerts();
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), ...result });
}
