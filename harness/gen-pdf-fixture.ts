/**
 * Generates harness/fixtures/forwarded-ref-in-pdf.eml — a deliberately hard
 * case: a representative FORWARDS a UKIPO examination report from their own
 * law-firm domain, the email body says only "see attached", and the reference
 * number + deadline live ONLY in the PDF. Tests attachment extraction and
 * content-first classification (sender is a distractor).
 *
 *   npx tsx harness/gen-pdf-fixture.ts
 * Re-run only if you want to regenerate the committed .eml.
 */
import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const PDF_LINES = [
  'INTELLECTUAL PROPERTY OFFICE',
  'Examination Report',
  '',
  'Application number: UK00003555444',
  'Trade mark: NORTHWIND AERO',
  'Class: 12',
  '',
  'An objection is raised under section 5(2)(b) of the Trade Marks Act 1994.',
  'The mark is similar to an earlier registration and covers identical goods.',
  '',
  'You have two months from the date of this report, expiring on',
  '30 September 2026, to respond with written observations or to request',
  'a hearing. If no response is received the application will be refused.',
];

async function main() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let y = 790;
  for (const line of PDF_LINES) {
    page.drawText(line, { x: 50, y, size: 11, font });
    y -= 20;
  }
  const b64 = Buffer.from(await doc.save()).toString('base64').replace(/(.{76})/g, '$1\n');

  const eml = [
    'From: "Fenwick & Hall IP" <trademarks@fenwickhall.example>',
    'To: bree-northwind@inbound.brandvault.app',
    'Subject: FW: Trade mark application - please see attached report',
    'Message-ID: <fwd-northwind-aero@fenwickhall.example>',
    'Date: Fri, 04 Jul 2026 12:00:00 +0100',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="BREEBOUNDARY"',
    '',
    '--BREEBOUNDARY',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'Hi,',
    '',
    'Please see the attached from the IPO on your application. Let me know how',
    "you'd like to proceed and we can prepare a response.",
    '',
    'Kind regards,',
    'Fenwick & Hall IP',
    '',
    '--BREEBOUNDARY',
    'Content-Type: application/pdf; name="examination-report.pdf"',
    'Content-Transfer-Encoding: base64',
    'Content-Disposition: attachment; filename="examination-report.pdf"',
    '',
    b64,
    '',
    '--BREEBOUNDARY--',
    '',
  ].join('\n');

  const out = path.join('harness/fixtures', 'forwarded-ref-in-pdf.eml');
  fs.writeFileSync(out, eml);
  console.log(`wrote ${out} (${eml.length} bytes, PDF attachment embedded)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
