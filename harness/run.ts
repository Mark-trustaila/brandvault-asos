/**
 * Email classification accuracy harness (Phase 4, Step 1). Local only.
 *
 *   npx tsx harness/run.ts                                  # real corpus (gitignored)
 *   npx tsx harness/run.ts --corpus harness/fixtures \
 *                          --labels harness/fixtures/labels.jsonl   # synthetic demo
 *
 * Classifies every .eml against its manual label and prints an accuracy report.
 * The gate that matters: NO email may be classified into HIGH confidence with
 * the wrong registry/type — that is the dangerous failure (it would trigger a
 * wrong automatic action). Any such case exits non-zero.
 */
import fs from 'fs';
import path from 'path';

// Load .env (ANTHROPIC_API_KEY) without a dependency; shell env wins.
(function loadEnv() {
  try {
    for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env — rely on shell env */
  }
})();

import { parseEml } from '../lib/eml';
import { classifyEmail } from '../lib/email-classifier';
import { AUTO_ACT_TYPES, type Classification } from '../lib/email-types';

type Label = { file: string; registry: string; type: string; refs?: string[]; expectHigh?: boolean; action?: string };

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const CORPUS = arg('corpus', 'harness/email-corpus');
const LABELS = arg('labels', 'harness/labels.jsonl');
const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toUpperCase();

async function main() {
  if (!fs.existsSync(LABELS)) {
    console.error(`No labels file at ${LABELS}. For the synthetic demo run:\n  npx tsx harness/run.ts --corpus harness/fixtures --labels harness/fixtures/labels.jsonl`);
    process.exit(1);
  }
  const labels: Label[] = fs
    .readFileSync(LABELS, 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('//'))
    .map((l) => JSON.parse(l));

  console.log(`Corpus: ${CORPUS}  |  ${labels.length} labelled emails  |  model ${process.env.EMAIL_CLASSIFIER_MODEL ?? 'claude-sonnet-4-6'}\n`);

  let scored = 0;
  let registryOk = 0;
  let typeOk = 0;
  let bothOk = 0;
  let refHits = 0;
  let refTotal = 0;
  let predHigh = 0;
  let missedHigh = 0;
  const dangerous: string[] = [];
  const failures: string[] = [];
  const byType = new Map<string, { n: number; ok: number }>();
  const seenMsg = new Map<string, string>();
  const seenHash = new Map<string, string>();
  const dupes: string[] = [];

  for (const label of labels) {
    const file = path.join(CORPUS, label.file);
    if (!fs.existsSync(file)) {
      failures.push(`${label.file}: FILE MISSING`);
      continue;
    }
    const email = await parseEml(fs.readFileSync(file));
    // Duplicate if the same Message-ID OR the same content hash was seen before.
    // Skip it, exactly as the live pipeline would — no re-classification.
    const prior = (email.messageId && seenMsg.get(email.messageId)) || seenHash.get(email.contentHash);
    if (prior) {
      dupes.push(`${label.file} == ${prior} (skipped by dedup)`);
      continue;
    }
    if (email.messageId) seenMsg.set(email.messageId, label.file);
    seenHash.set(email.contentHash, label.file);

    let c: Classification;
    try {
      c = await classifyEmail({
        subject: email.subject,
        bodyText: email.bodyText,
        attachmentTexts: email.attachments.map((a) => a.extractedText).filter(Boolean),
        fromAddress: email.fromAddress,
      });
    } catch (e) {
      failures.push(`${label.file}: CLASSIFIER ERROR — ${(e as Error).message}`);
      continue;
    }

    scored++;
    const rOk = c.registry === label.registry;
    const tOk = c.communicationType === label.type;
    if (rOk) registryOk++;
    if (tOk) typeOk++;
    if (rOk && tOk) bothOk++;

    const t = byType.get(label.type) ?? { n: 0, ok: 0 };
    t.n++;
    if (rOk && tOk) t.ok++;
    byType.set(label.type, t);

    for (const ref of label.refs ?? []) {
      refTotal++;
      if (c.referenceNumbers.some((r) => norm(r) === norm(ref))) refHits++;
    }

    if (c.confidence === 'high') {
      predHigh++;
      if (!rOk || !tOk) dangerous.push(`${label.file}: predicted HIGH but ${!rOk ? `registry ${c.registry}≠${label.registry}` : ''}${!rOk && !tOk ? ', ' : ''}${!tOk ? `type ${c.communicationType}≠${label.type}` : ''}`);
    }
    if (label.expectHigh && c.confidence !== 'high') {
      missedHigh++;
      failures.push(`${label.file}: expected HIGH, got ${c.confidence} (conservative miss)`);
    }
    if (!rOk || !tOk) {
      failures.push(`${label.file}: registry ${c.registry}${rOk ? '' : `≠${label.registry}`} · type ${c.communicationType}${tOk ? '' : `≠${label.type}`} · conf ${c.confidence}`);
    }
  }

  const n = scored;
  const pct = (x: number, d: number) => (d ? ((100 * x) / d).toFixed(0) + '%' : '—');
  console.log('── Accuracy ──────────────────────────────');
  console.log(`  classified:      ${scored}  (${dupes.length} skipped as duplicates)`);
  console.log(`  registry:        ${registryOk}/${n}  (${pct(registryOk, n)})`);
  console.log(`  type:            ${typeOk}/${n}  (${pct(typeOk, n)})`);
  console.log(`  registry+type:   ${bothOk}/${n}  (${pct(bothOk, n)})`);
  console.log(`  reference recall:${refHits}/${refTotal}  (${pct(refHits, refTotal)})`);
  console.log('\n── By type (registry+type correct) ───────');
  for (const [type, s] of Array.from(byType.entries())) console.log(`  ${type.padEnd(28)} ${s.ok}/${s.n}  (${pct(s.ok, s.n)})${AUTO_ACT_TYPES.includes(type as never) ? '  [auto-act]' : ''}`);
  console.log('\n── Confidence ────────────────────────────');
  console.log(`  predicted HIGH:  ${predHigh}   conservative misses (expected HIGH, got lower): ${missedHigh}`);

  if (dupes.length) {
    console.log('\n── Duplicates detected (dedup works) ─────');
    dupes.forEach((d) => console.log(`  ${d}`));
  }
  if (failures.length) {
    console.log('\n── Failures ──────────────────────────────');
    failures.forEach((f) => console.log(`  ✗ ${f}`));
  }

  console.log('\n══════════════════════════════════════════');
  if (dangerous.length) {
    console.log(`DANGEROUS: ${dangerous.length} HIGH-confidence misclassification(s) — these would trigger wrong auto-actions:`);
    dangerous.forEach((d) => console.log(`  ‼ ${d}`));
    console.log('FAIL');
    process.exit(1);
  }
  console.log(`No dangerous HIGH-confidence failures. registry+type ${pct(bothOk, n)} (target >90% on HIGH-confidence types).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
