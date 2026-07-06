/**
 * Verifies the corrections → corpus feedback loop against the LOCAL db.
 * Creates a reviewed InboundEmail, runs export-corrections into a temp dir, and
 * asserts the reconstructed .eml + labelled example are written. Never touches
 * the real harness corpus.
 *
 *   npx tsx scripts/verify-inbox-export.ts
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { prisma } from '../lib/db';
import { contentHashOf } from '../lib/eml';

const SLUG = 'verify-inbox-export-tmp';
let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
  cond ? pass++ : fail++;
};

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bv-corpus-'));
  const corpus = path.join(tmp, 'corpus');
  const labels = path.join(tmp, 'labels.jsonl');

  await prisma.company.deleteMany({ where: { slug: SLUG } });
  const co = await prisma.company.create({ data: { name: 'Verify Inbox Export', slug: SLUG } });

  const subject = 'Trade Mark Correspondence - opposition OP000999888';
  const body = 'The UKIPO Tribunal writes regarding opposition OP000999888 against UK00004123456.';
  const ie = await prisma.inboundEmail.create({
    data: {
      companyId: co.id, fromAddress: 'noreply@ipo.gov.uk', subject, bodyText: body,
      contentHash: contentHashOf(subject, body), status: 'processed',
      classificationJson: { registry: 'UKIPO', communicationType: 'opposition_procedural', referenceNumbers: ['OP000999888', 'UK00004123456'] },
      // Human corrected it from opposition_procedural to opposition_notice:
      reviewClassificationJson: { registry: 'UKIPO', communicationType: 'opposition_notice', note: 'human said initial notice' },
      reviewedAt: new Date(),
      attachments: { create: [{ filename: 'tribunal.pdf', mimeType: 'application/pdf', extractedText: 'Opposition OP000999888 details ...' }] },
    },
  });

  // Run the export into the temp dir.
  const out = execFileSync('npx', ['tsx', 'scripts/export-corrections.ts'], {
    env: { ...process.env, CORPUS_DIR: corpus, LABELS_FILE: labels },
    encoding: 'utf8',
  });
  console.log('  ' + out.trim().split('\n').pop());

  const emlPath = path.join(corpus, `reviewed-${ie.id}.eml`);
  check('reconstructed .eml written', fs.existsSync(emlPath));
  const eml = fs.existsSync(emlPath) ? fs.readFileSync(emlPath, 'utf8') : '';
  check('.eml includes body + attachment text', eml.includes('OP000999888') && eml.includes('attachment text'));

  const labelLines = fs.existsSync(labels) ? fs.readFileSync(labels, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const label = labelLines.find((l) => l.file === `reviewed-${ie.id}.eml`);
  check('labelled example appended', Boolean(label));
  check('label uses the HUMAN correction (opposition_notice)', label?.type === 'opposition_notice', label?.type);
  check('label carries the reference numbers', Array.isArray(label?.refs) && label.refs.includes('OP000999888'));

  await prisma.company.delete({ where: { id: co.id } });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
