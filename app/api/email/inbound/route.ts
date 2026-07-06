import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import {
  postmarkConfigured,
  verifyPostmarkRequest,
  normalizePostmark,
  slugFromRecipients,
  type PostmarkInbound,
} from '../../../../lib/postmark';
import { storeInboundEmail } from '../../../../lib/inbound-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Attachment (PDF) extraction can be slow — allow headroom.
export const maxDuration = 60;

// POST /api/email/inbound — Postmark inbound webhook. Verifies the shared
// secret, resolves the company from the bree-{slug}@… recipient, and stores the
// email (deduped) as `pending`. Classification + actions are Step 3.
//
// Always answers 200 for accepted-but-unactionable cases (unknown recipient) so
// Postmark does not retry-storm; only auth failure and server errors are non-200.
export async function POST(req: Request) {
  if (!postmarkConfigured()) {
    return NextResponse.json({ error: 'Inbound email is not configured' }, { status: 503 });
  }
  if (!verifyPostmarkRequest(req)) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  let payload: PostmarkInbound;
  try {
    payload = (await req.json()) as PostmarkInbound;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const email = await normalizePostmark(payload);

  const slug = slugFromRecipients(email.recipients);
  if (!slug) {
    return NextResponse.json({ status: 'no_inbound_slug', recipients: email.recipients });
  }
  const company = await prisma.company.findUnique({ where: { inboundEmailSlug: slug }, select: { id: true } });
  if (!company) {
    // Ack so Postmark stops retrying; nothing to attach it to.
    return NextResponse.json({ status: 'no_company_for_slug', slug });
  }

  const result = await storeInboundEmail(company.id, {
    messageId: email.messageId,
    fromAddress: email.fromAddress,
    subject: email.subject,
    bodyText: email.bodyText,
    contentHash: email.contentHash,
    rawHeaders: email.rawHeaders,
    attachments: email.attachments,
  });

  return NextResponse.json({ ok: true, id: result.id, deduped: result.deduped, status: 'pending' });
}
