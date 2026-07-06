/**
 * Postmark inbound webhook: request verification + payload normalization.
 *
 * Postmark does NOT HMAC-sign inbound webhooks; the recommended protection is a
 * shared secret carried on the webhook URL. We accept that secret three ways so
 * it works however the URL is configured:
 *   - HTTP Basic Auth password         (https://user:SECRET@host/api/email/inbound)
 *   - ?token=SECRET query parameter
 *   - X-Postmark-Webhook-Token header
 * All compared to POSTMARK_INBOUND_SECRET in constant time.
 */
import crypto from 'crypto';
import { extractPdfText, isPdf } from './pdf-text';
import { contentHashOf } from './eml';

export function postmarkConfigured(): boolean {
  return Boolean(process.env.POSTMARK_INBOUND_SECRET);
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** The secret presented on the request, from any of the supported carriers. */
function presentedToken(req: Request): string {
  const url = new URL(req.url);
  const q = url.searchParams.get('token');
  if (q) return q;
  const header = req.headers.get('x-postmark-webhook-token');
  if (header) return header;
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    try {
      const [, pass] = Buffer.from(auth.slice(6), 'base64').toString('utf8').split(':');
      if (pass) return pass;
    } catch {
      /* malformed header */
    }
  }
  return '';
}

export function verifyPostmarkRequest(req: Request): boolean {
  const secret = process.env.POSTMARK_INBOUND_SECRET ?? '';
  if (!secret) return false;
  return timingSafeEqual(presentedToken(req), secret);
}

// ---- Payload normalization ----

type PostmarkAttachment = { Name?: string; Content?: string; ContentType?: string };
export type PostmarkInbound = {
  MessageID?: string;
  From?: string;
  FromFull?: { Email?: string };
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  To?: string;
  ToFull?: { Email?: string }[];
  OriginalRecipient?: string;
  Headers?: { Name: string; Value: string }[];
  Attachments?: PostmarkAttachment[];
};

export type NormalizedInbound = {
  messageId: string | null;
  fromAddress: string;
  subject: string;
  bodyText: string;
  contentHash: string;
  rawHeaders: { Name: string; Value: string }[];
  recipients: string[];
  attachments: { filename: string; mimeType: string; extractedText: string }[];
};

// Unwrap "Display Name <addr@x>" -> "addr@x"; lower-case.
const cleanAddr = (a: string): string => {
  const m = a.match(/<([^>]+)>/);
  return (m ? m[1] : a).trim().toLowerCase();
};

/** Every candidate recipient address (for resolving the company by inbound slug). */
export function recipientAddresses(p: PostmarkInbound): string[] {
  const out = new Set<string>();
  if (p.OriginalRecipient) out.add(cleanAddr(p.OriginalRecipient));
  if (p.To) p.To.split(',').forEach((a) => out.add(cleanAddr(a)));
  (p.ToFull ?? []).forEach((t) => t.Email && out.add(cleanAddr(t.Email)));
  return Array.from(out);
}

/** Pull the inbound slug from a `bree-{slug}@…` recipient, if present. */
export function slugFromRecipients(recipients: string[]): string | null {
  for (const addr of recipients) {
    const m = addr.match(/(?:^|<)\s*bree-([a-z0-9-]+)@/i);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

export async function normalizePostmark(p: PostmarkInbound): Promise<NormalizedInbound> {
  const subject = p.Subject ?? '';
  const bodyText = (p.TextBody ?? p.StrippedTextReply ?? '').trim();

  const attachments: NormalizedInbound['attachments'] = [];
  for (const att of p.Attachments ?? []) {
    const filename = att.Name ?? 'attachment';
    const mimeType = att.ContentType ?? 'application/octet-stream';
    let extractedText = '';
    if (att.Content && isPdf(filename, mimeType)) {
      extractedText = await extractPdfText(Buffer.from(att.Content, 'base64'));
    }
    attachments.push({ filename, mimeType, extractedText });
  }

  return {
    messageId: p.MessageID ?? null,
    fromAddress: p.FromFull?.Email ?? p.From ?? '',
    subject,
    bodyText,
    contentHash: contentHashOf(subject, bodyText),
    rawHeaders: p.Headers ?? [],
    recipients: recipientAddresses(p),
    attachments,
  };
}
