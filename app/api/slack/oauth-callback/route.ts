import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { APP_BASE_URL, verifyState, exchangeCode } from '../../../../lib/slack';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const back = (status: string) => NextResponse.redirect(`${APP_BASE_URL}/settings/alerts?slack=${status}`);

// GET /api/slack/oauth-callback — Slack redirects here after consent. Verifies
// the state, exchanges the code for a bot token, and stores the install on the
// company's AlertPreference (creating it if needed).
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('error') || !url.searchParams.get('code') || !url.searchParams.get('state')) {
    return back('denied');
  }
  const companyId = verifyState(url.searchParams.get('state')!);
  if (!companyId) return back('badstate');

  const result = await exchangeCode(url.searchParams.get('code')!);
  if (!result.ok || !result.access_token) return back('error');

  await prisma.alertPreference.upsert({
    where: { companyId },
    update: {
      slackTeamId: result.team?.id ?? null,
      slackTeamName: result.team?.name ?? null,
      slackBotToken: result.access_token,
      slackEnabled: true,
    },
    create: {
      companyId,
      slackTeamId: result.team?.id ?? null,
      slackTeamName: result.team?.name ?? null,
      slackBotToken: result.access_token,
      slackEnabled: true,
      thresholdDays: [180, 90, 30],
    },
  });

  return back('connected');
}
