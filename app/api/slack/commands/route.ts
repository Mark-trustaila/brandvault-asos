import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { slackConfig, verifySlackSignature } from '../../../../lib/slack';
import { parseBreeCommand } from '../../../../lib/bree-commands';
import * as bree from '../../../../lib/bree-messages';
import { portfolioSummary, upcomingRenewals, markStatus } from '../../../../lib/bree-queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const reply = (msg: { text: string; blocks: unknown[] }) =>
  NextResponse.json({ response_type: 'ephemeral', text: msg.text, blocks: msg.blocks });

// POST /api/slack/commands — handles `/bree ...`. Slack sends an
// x-www-form-urlencoded body; we verify its signature, map the workspace to a
// company, and answer with an ephemeral Block Kit message.
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

  const form = new URLSearchParams(raw);
  const teamId = form.get('team_id') ?? '';
  const cmd = parseBreeCommand(form.get('text') ?? '');

  const pref = await prisma.alertPreference.findFirst({ where: { slackTeamId: teamId } });
  if (!pref) {
    return reply({
      text: 'This Slack workspace is not connected to a BrandVault company yet.',
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: 'This workspace isn’t connected to a BrandVault company yet. An admin can connect it from *Settings → Alerts*.' },
        },
      ],
    });
  }
  const companyId = pref.companyId;

  switch (cmd.kind) {
    case 'portfolio': {
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      const data = await portfolioSummary(companyId);
      return reply(bree.portfolioSummary({ companyName: company?.name ?? 'Your portfolio', ...data }));
    }
    case 'renewals':
      return reply(bree.renewalsList({ items: await upcomingRenewals(companyId, 5) }));
    case 'status': {
      if (!cmd.query) return reply(bree.help());
      const groups = await markStatus(companyId, cmd.query);
      return reply(groups.length ? bree.markStatusMsg({ query: cmd.query, groups }) : bree.notFound(cmd.query));
    }
    case 'help':
    case 'unknown':
    default:
      return reply(bree.help());
  }
}
