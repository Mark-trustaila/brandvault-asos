import { NextResponse } from 'next/server';
import { slackConfig, verifySlackSignature } from '../../../../lib/slack';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/slack/interactivity — Slack's interactivity Request URL. Bree's
// messages don't yet include interactive components, so there are no actions to
// handle; we just verify the signature and acknowledge with 200 so Slack's
// URL check passes and future button clicks don't 404.
export async function POST(req: Request) {
  const raw = await req.text();
  const cfg = slackConfig();
  if (cfg.signingSecret) {
    const ok = verifySlackSignature({
      signingSecret: cfg.signingSecret,
      timestamp: req.headers.get('x-slack-request-timestamp') ?? '',
      body: raw,
      signature: req.headers.get('x-slack-signature') ?? '',
    });
    if (!ok) return new NextResponse('bad signature', { status: 401 });
  }
  return new NextResponse(null, { status: 200 });
}
