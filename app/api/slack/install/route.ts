import { NextResponse } from 'next/server';
import { getRequestContext } from '../../../../lib/authz';
import { authorizeUrl, slackConfigured } from '../../../../lib/slack';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/slack/install — a company admin starts the Slack (Bree) OAuth install.
// Redirects to Slack's consent screen; the callback stores the bot token against
// this company (state carries the signed company id).
export async function GET(req: Request) {
  const { ctx, error } = await getRequestContext(req);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });
  if (ctx.user.role !== 'admin' && !ctx.isPlatformAdmin) {
    return NextResponse.json({ error: 'Only a company admin can connect Slack' }, { status: 403 });
  }
  if (!slackConfigured()) {
    return NextResponse.json({ error: 'Slack is not configured on the server' }, { status: 503 });
  }
  return NextResponse.redirect(authorizeUrl(ctx.company.id));
}
