/**
 * Feed reviewed inbound emails back into the harness corpus as labelled
 * examples. Reads InboundEmails that a human has confirmed/corrected
 * (review_classification_json set) and writes, for each:
 *   - harness/email-corpus/reviewed-<id>.eml  (reconstructed from stored text)
 *   - a label line in harness/labels.jsonl using the HUMAN's classification
 * so prompt changes can be re-measured against real, human-labelled mail.
 *
 * Local only — corpus + labels are gitignored. Point at Azure to pull live
 * reviews:
 *   ( set -a; . ./.env.azure.local; set +a; npx tsx scripts/export-corrections.ts )
 * or run against the local DB with the default DATABASE_URL.
 */
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/db';

const CORPUS = process.env.CORPUS_DIR ?? 'harness/email-corpus';
const LABELS = process.env.LABELS_FILE ?? 'harness/labels.jsonl';

type Review = { registry?: string; communicationType?: string; note?: string };

async function main() {
  fs.mkdirSync(CORPUS, { recursive: true });
  const reviewed = await prisma.inboundEmail.findMany({
    where: { reviewedAt: { not: null } },
    include: { attachments: { select: { extractedText: true } } },
  });
  // Only confirm/correct set a review classification; dismiss doesn't.
  const rows = reviewed.filter((r) => r.reviewClassificationJson != null);

  const existing = new Set(
    fs.existsSync(LABELS) ? fs.readFileSync(LABELS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).file) : []
  );

  const newLabels: string[] = [];
  let written = 0;
  for (const r of rows) {
    const file = `reviewed-${r.id}.eml`;
    const review = r.reviewClassificationJson as Review;
    const bree = (r.classificationJson ?? {}) as { referenceNumbers?: string[] };

    // Reconstruct a minimal .eml; append attachment text so the classifier sees
    // the same content it originally did.
    const attachText = r.attachments.map((a) => a.extractedText).filter(Boolean).join('\n\n');
    const eml = [
      `From: ${r.fromAddress || 'unknown@example.com'}`,
      `Subject: ${r.subject}`,
      `Message-ID: <${r.messageId ?? r.id}>`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      r.bodyText,
      attachText ? `\n--- attachment text ---\n${attachText}` : '',
    ].join('\n');
    fs.writeFileSync(path.join(CORPUS, file), eml);

    if (!existing.has(file)) {
      newLabels.push(
        JSON.stringify({
          file,
          registry: review.registry ?? 'unknown',
          type: review.communicationType ?? 'other',
          refs: bree.referenceNumbers ?? [],
          expectHigh: false,
          note: review.note ?? 'human-reviewed',
        })
      );
    }
    written++;
  }

  if (newLabels.length) fs.appendFileSync(LABELS, (fs.existsSync(LABELS) && fs.readFileSync(LABELS, 'utf8').length ? '' : '') + newLabels.join('\n') + '\n');
  console.log(`Exported ${written} reviewed email(s) to ${CORPUS}; ${newLabels.length} new label(s) appended to ${LABELS}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
