/**
 * Parse a raw RFC-822 message (.eml) into the pieces the classifier needs.
 * Uses mailparser (robust MIME handling: multipart, forwarded chains,
 * attachments). Also extracts PDF attachment text so the classifier sees the
 * real document when the body is just "please see attached".
 */
import { simpleParser } from 'mailparser';
import crypto from 'crypto';
import { extractPdfText, isPdf } from './pdf-text';

export type ParsedAttachment = { filename: string; mimeType: string; extractedText: string };

/** Stable content hash for dedup — identical for the same subject+body whether
 *  the email arrives as a .eml (harness) or a Postmark webhook (ingestion). */
export function contentHashOf(subject: string, bodyText: string): string {
  return crypto.createHash('sha256').update(`${subject}\n${bodyText}`).digest('hex');
}

export type ParsedEmail = {
  messageId: string | null;
  fromAddress: string;
  subject: string;
  bodyText: string;
  attachments: ParsedAttachment[];
  /** stable hash for dedup when Message-ID is absent (content-based) */
  contentHash: string;
};

export async function parseEml(raw: Buffer | string): Promise<ParsedEmail> {
  const mail = await simpleParser(raw);
  const bodyText = (mail.text ?? '').trim();
  const subject = mail.subject ?? '';

  const attachments: ParsedAttachment[] = [];
  for (const att of mail.attachments ?? []) {
    const filename = att.filename ?? 'attachment';
    const mimeType = att.contentType ?? 'application/octet-stream';
    const extractedText = isPdf(filename, mimeType) ? await extractPdfText(att.content as Buffer) : '';
    attachments.push({ filename, mimeType, extractedText });
  }

  const contentHash = contentHashOf(subject, bodyText);

  return {
    messageId: mail.messageId ?? null,
    fromAddress: mail.from?.value?.[0]?.address ?? mail.from?.text ?? '',
    subject,
    bodyText,
    attachments,
    contentHash,
  };
}

/** Dedup key: prefer Message-ID, fall back to the content hash. */
export const dedupKey = (e: ParsedEmail): string => e.messageId ?? `sha:${e.contentHash}`;
