/**
 * Persist an inbound email (+ attachments) for a company, idempotently.
 * Step 2 only stores it as `pending`; the Step 3 processor classifies and acts.
 *
 * Dedup: an email is a duplicate if the same Message-ID or the same content
 * hash was already stored for the company. The DB unique on
 * (company_id, content_hash) is the race-safe backstop.
 */
import { prisma } from './db';

export type StorableInbound = {
  messageId: string | null;
  fromAddress: string;
  subject: string;
  bodyText: string;
  contentHash: string;
  rawHeaders: unknown;
  attachments: { filename: string; mimeType: string; extractedText: string }[];
};

export type StoreResult = { id: string; deduped: boolean };

export async function storeInboundEmail(companyId: string, email: StorableInbound): Promise<StoreResult> {
  // Fast-path dedup: same content, or same Message-ID, already stored.
  const existing = await prisma.inboundEmail.findFirst({
    where: {
      companyId,
      OR: [{ contentHash: email.contentHash }, ...(email.messageId ? [{ messageId: email.messageId }] : [])],
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, deduped: true };

  try {
    const created = await prisma.inboundEmail.create({
      data: {
        companyId,
        fromAddress: email.fromAddress,
        subject: email.subject,
        bodyText: email.bodyText,
        messageId: email.messageId,
        contentHash: email.contentHash,
        rawHeadersJson: email.rawHeaders as never,
        status: 'pending',
        attachments: {
          create: email.attachments.map((a) => ({
            filename: a.filename,
            mimeType: a.mimeType,
            extractedText: a.extractedText || null,
          })),
        },
      },
      select: { id: true },
    });
    return { id: created.id, deduped: false };
  } catch (e) {
    // Unique (company_id, content_hash) lost a race — treat as a duplicate.
    if ((e as { code?: string }).code === 'P2002') {
      const dup = await prisma.inboundEmail.findFirst({
        where: { companyId, contentHash: email.contentHash },
        select: { id: true },
      });
      if (dup) return { id: dup.id, deduped: true };
    }
    throw e;
  }
}
