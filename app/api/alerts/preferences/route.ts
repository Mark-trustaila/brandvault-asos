import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getActingCompany, getRequestContext } from '../../../../lib/authz';
import { DEFAULT_THRESHOLDS } from '../../../../lib/alerts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/alerts/preferences — alert settings for the acting company.
export async function GET(req: Request) {
  const company = await getActingCompany(req);
  if (!company) return NextResponse.json({ error: 'No active organization' }, { status: 403 });
  const p = await prisma.alertPreference.findUnique({ where: { companyId: company.id } });
  return NextResponse.json({
    slackConnected: Boolean(p?.slackBotToken),
    slackTeamName: p?.slackTeamName ?? null,
    slackEnabled: p?.slackEnabled ?? false,
    slackChannelId: p?.slackChannelId ?? '',
    emailEnabled: p?.emailEnabled ?? true,
    emailAvailable: false, // SMTP not wired yet — UI shows "coming soon"
    thresholdDays: (Array.isArray(p?.thresholdDays) ? (p!.thresholdDays as number[]) : DEFAULT_THRESHOLDS),
    installUrl: '/api/slack/install',
  });
}

// PATCH /api/alerts/preferences — update settings (company admin only).
export async function PATCH(req: Request) {
  const { ctx, error } = await getRequestContext(req);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });
  if (ctx.user.role !== 'admin' && !ctx.isPlatformAdmin) {
    return NextResponse.json({ error: 'Only a company admin can change alert settings' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.slackEnabled === 'boolean') data.slackEnabled = body.slackEnabled;
  if (typeof body.emailEnabled === 'boolean') data.emailEnabled = body.emailEnabled;
  if (typeof body.slackChannelId === 'string') data.slackChannelId = body.slackChannelId.trim() || null;
  if (Array.isArray(body.thresholdDays)) {
    const t = body.thresholdDays.filter((n: unknown) => typeof n === 'number' && n > 0).slice(0, 3);
    if (t.length) data.thresholdDays = t.sort((a: number, b: number) => b - a);
  }

  await prisma.alertPreference.upsert({
    where: { companyId: ctx.company.id },
    update: data,
    create: {
      companyId: ctx.company.id,
      thresholdDays: (data.thresholdDays as number[]) ?? DEFAULT_THRESHOLDS,
      ...data,
    },
  });
  return NextResponse.json({ ok: true });
}
