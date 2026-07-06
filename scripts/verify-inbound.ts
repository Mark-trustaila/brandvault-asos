/**
 * End-to-end check of the inbound pipeline against the LOCAL db (never Azure).
 * Drives the actual POST /api/email/inbound handler with mock Postmark payloads:
 * secret verification, slug->company resolution, PDF attachment extraction,
 * store, and dedup. Creates a throwaway company and deletes it afterwards.
 *
 *   npx tsx scripts/verify-inbound.ts
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { prisma } from '../lib/db';
import { POST } from '../app/api/email/inbound/route';

const SECRET = 'verify-inbound-secret';
const SLUG = 'verify-inbound-tmp';
const URL = `https://brandvault-asos.vercel.app/api/email/inbound?token=${SECRET}`;

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
  cond ? pass++ : fail++;
};

async function pdfB64(text: string): Promise<string> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 50, y: 700, size: 12, font });
  return Buffer.from(await doc.save()).toString('base64');
}

function req(payload: unknown): Request {
  return new Request(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
}

async function main() {
  process.env.POSTMARK_INBOUND_SECRET = SECRET;

  // Clean any leftover, then create the throwaway company.
  await prisma.company.deleteMany({ where: { slug: SLUG } });
  const company = await prisma.company.create({ data: { name: 'Verify Inbound Tmp', slug: SLUG, inboundEmailSlug: SLUG } });

  const basePayload = {
    MessageID: 'verify-msg-1',
    From: 'noreply@ipo.gov.uk',
    FromFull: { Email: 'noreply@ipo.gov.uk' },
    Subject: 'Certificate of Registration - UK00003456789',
    TextBody: 'Please see the attached certificate.',
    OriginalRecipient: `bree-${SLUG}@inbound.brandvault.app`,
    ToFull: [{ Email: `bree-${SLUG}@inbound.brandvault.app` }],
    Attachments: [{ Name: 'cert.pdf', ContentType: 'application/pdf', Content: await pdfB64('Application number: UK00003456789') }],
  };

  // 1. Auth: wrong token rejected.
  const bad = await POST(new Request(`https://x/api/email/inbound?token=wrong`, { method: 'POST', body: '{}' }));
  check('wrong secret -> 401', bad.status === 401);

  // 2. First delivery stores it.
  const r1 = await POST(req(basePayload));
  const j1 = await r1.json();
  check('first delivery stored', r1.status === 200 && j1.ok && j1.deduped === false, JSON.stringify(j1));

  // 3. Attachment text extracted + persisted.
  const stored = await prisma.inboundEmail.findUnique({ where: { id: j1.id }, include: { attachments: true } });
  check('status pending', stored?.status === 'pending');
  check('attachment extracted text persisted', Boolean(stored?.attachments[0]?.extractedText?.includes('UK00003456789')));

  // 4. Same email again -> deduped (same id, nothing new created).
  const r2 = await POST(req(basePayload));
  const j2 = await r2.json();
  check('identical redelivery deduped', j2.deduped === true && j2.id === j1.id, JSON.stringify(j2));

  // 5. Different message-id but identical content -> still deduped (content hash).
  const r3 = await POST(req({ ...basePayload, MessageID: 'verify-msg-DIFFERENT' }));
  const j3 = await r3.json();
  check('same content, new Message-ID deduped', j3.deduped === true && j3.id === j1.id, JSON.stringify(j3));

  // 6. Genuinely different email -> stored as new.
  const r4 = await POST(req({ ...basePayload, MessageID: 'verify-msg-2', Subject: 'Renewal reminder', TextBody: 'Your renewal is due.' }));
  const j4 = await r4.json();
  check('different content stored separately', j4.deduped === false && j4.id !== j1.id, JSON.stringify(j4));

  // 7. Unknown recipient slug -> acked, not stored.
  const r5 = await POST(req({ ...basePayload, OriginalRecipient: 'bree-nobody@inbound.brandvault.app', ToFull: [{ Email: 'bree-nobody@inbound.brandvault.app' }] }));
  const j5 = await r5.json();
  check('unknown slug acked without storing', r5.status === 200 && j5.status === 'no_company_for_slug');

  const total = await prisma.inboundEmail.count({ where: { companyId: company.id } });
  check('exactly 2 rows stored for the company', total === 2, `got ${total}`);

  // Cleanup (cascades inbound emails + attachments).
  await prisma.company.delete({ where: { id: company.id } });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
