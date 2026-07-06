import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  verifyPostmarkRequest,
  postmarkConfigured,
  slugFromRecipients,
  recipientAddresses,
  normalizePostmark,
} from '../lib/postmark';

const SECRET = 'topsecret-inbound';
const url = 'https://brandvault-asos.vercel.app/api/email/inbound';

beforeAll(() => {
  process.env.POSTMARK_INBOUND_SECRET = SECRET;
});
afterAll(() => {
  delete process.env.POSTMARK_INBOUND_SECRET;
});

describe('verifyPostmarkRequest', () => {
  it('accepts the secret via ?token=', () => {
    expect(verifyPostmarkRequest(new Request(`${url}?token=${SECRET}`))).toBe(true);
  });
  it('accepts the secret via X-Postmark-Webhook-Token header', () => {
    expect(verifyPostmarkRequest(new Request(url, { headers: { 'x-postmark-webhook-token': SECRET } }))).toBe(true);
  });
  it('accepts the secret as the Basic Auth password', () => {
    const basic = 'Basic ' + Buffer.from(`postmark:${SECRET}`).toString('base64');
    expect(verifyPostmarkRequest(new Request(url, { headers: { authorization: basic } }))).toBe(true);
  });
  it('rejects a wrong secret and a missing secret', () => {
    expect(verifyPostmarkRequest(new Request(`${url}?token=nope`))).toBe(false);
    expect(verifyPostmarkRequest(new Request(url))).toBe(false);
  });
  it('postmarkConfigured reflects the env', () => {
    expect(postmarkConfigured()).toBe(true);
  });
});

describe('recipient / slug parsing', () => {
  it('collects recipients from OriginalRecipient, To and ToFull', () => {
    const r = recipientAddresses({
      OriginalRecipient: 'bree-acme@inbound.brandvault.app',
      To: 'Someone <other@x.com>',
      ToFull: [{ Email: 'bree-acme@inbound.brandvault.app' }],
    });
    expect(r).toContain('bree-acme@inbound.brandvault.app');
    expect(r).toContain('other@x.com');
  });
  it('extracts the slug from a bree-{slug}@ recipient', () => {
    expect(slugFromRecipients(['other@x.com', 'bree-northwind-brands@inbound.brandvault.app'])).toBe('northwind-brands');
  });
  it('returns null when no inbound address is present', () => {
    expect(slugFromRecipients(['someone@example.com'])).toBeNull();
  });
});

describe('normalizePostmark', () => {
  it('normalizes fields and computes a stable content hash', async () => {
    const n = await normalizePostmark({
      MessageID: 'abc-123',
      From: 'noreply@ipo.gov.uk',
      FromFull: { Email: 'noreply@ipo.gov.uk' },
      Subject: 'Certificate of Registration',
      TextBody: 'Your mark is registered.',
    });
    expect(n.messageId).toBe('abc-123');
    expect(n.fromAddress).toBe('noreply@ipo.gov.uk');
    expect(n.contentHash).toHaveLength(64);
    const again = await normalizePostmark({ Subject: 'Certificate of Registration', TextBody: 'Your mark is registered.' });
    expect(again.contentHash).toBe(n.contentHash); // hash depends only on subject+body
  });

  it('extracts text from a base64 PDF attachment', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Application number: UK00003555444', { x: 50, y: 700, size: 12, font });
    const b64 = Buffer.from(await doc.save()).toString('base64');

    const n = await normalizePostmark({
      Subject: 'FW: please see attached',
      TextBody: 'see attached',
      Attachments: [{ Name: 'report.pdf', ContentType: 'application/pdf', Content: b64 }],
    });
    expect(n.attachments).toHaveLength(1);
    expect(n.attachments[0].extractedText).toContain('UK00003555444');
  });
});
