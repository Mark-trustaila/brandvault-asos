import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { slackConfig, verifySlackSignature } from '../../../../lib/slack';
import { prisma } from '../../../../lib/db';
import { applyApproval, rejectApproval, type Decider } from '../../../../lib/approvals';
import * as bree from '../../../../lib/bree-messages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ApprovalAction = 'renewal_confirmation' | 'registration_certificate';

// Replace the original message (buttons → outcome) so it can't be actioned twice.
async function updateSlackMessage(responseUrl: string, msg: { text: string; blocks: unknown[] }) {
  try {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replace_original: true, text: msg.text, blocks: msg.blocks }),
    });
  } catch {
    /* best effort — the DB write already happened / didn't */
  }
}

/**
 * POST /api/slack/interactivity — Slack's interactivity Request URL. Handles the
 * Approve/Reject buttons on Bree's approval messages: verifies the signature,
 * acknowledges within Slack's 3s window, then applies (or rejects) the proposal
 * and rewrites the message with the outcome. All other payloads are just acked.
 */
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

  // Slack sends application/x-www-form-urlencoded with a `payload` JSON field.
  const payloadRaw = new URLSearchParams(raw).get('payload');
  if (!payloadRaw) return new NextResponse(null, { status: 200 });
  let payload: {
    actions?: { action_id?: string; value?: string }[];
    response_url?: string;
    user?: { id?: string; username?: string; name?: string };
    team?: { id?: string };
  };
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    return new NextResponse(null, { status: 200 });
  }

  const action = payload.actions?.[0];
  const responseUrl = payload.response_url;
  const isApprove = action?.action_id === 'approval_approve';
  const isReject = action?.action_id === 'approval_reject';
  if (!action?.value || !responseUrl || (!isApprove && !isReject)) {
    return new NextResponse(null, { status: 200 });
  }

  const approvalId = action.value;
  const teamId = payload.team?.id;
  const decider: Decider = { slackUserId: payload.user?.id, slackUserName: payload.user?.username || payload.user?.name };

  // Ack immediately; do the DB work + message rewrite async (Slack allows 3s).
  waitUntil(
    (async () => {
      // Guard: the clicking workspace must own this approval's company install.
      const scoped = await prisma.approval.findUnique({
        where: { id: approvalId },
        select: { company: { select: { alertPreference: { select: { slackTeamId: true } } } } },
      });
      const expectedTeam = scoped?.company.alertPreference?.slackTeamId ?? null;
      if (expectedTeam && teamId && expectedTeam !== teamId) {
        await updateSlackMessage(responseUrl, { text: 'Not authorised for this workspace.', blocks: [] });
        return;
      }

      const res = isApprove ? await applyApproval(approvalId, decider) : await rejectApproval(approvalId, decider);
      if (res.status === 'not_found') {
        await updateSlackMessage(responseUrl, { text: 'This approval could not be found.', blocks: [] });
        return;
      }
      const by = decider.slackUserName ? `@${decider.slackUserName}` : 'a workspace user';
      const mark = res.mark ?? { markText: 'the mark', registry: '' };
      const actionType = (res.actionType as ApprovalAction) ?? 'renewal_confirmation';
      if (res.status === 'already_decided') {
        await updateSlackMessage(
          responseUrl,
          bree.emailApprovalResolved({ decision: 'approved', action: actionType, markText: mark.markText, registry: mark.registry, by: 'someone', effect: 'This request had already been decided — no change made now.' })
        );
        return;
      }
      await updateSlackMessage(
        responseUrl,
        bree.emailApprovalResolved({ decision: isApprove ? 'approved' : 'rejected', action: actionType, markText: mark.markText, registry: mark.registry, by, effect: res.effect ?? '' })
      );
    })()
  );

  return new NextResponse(null, { status: 200 });
}
