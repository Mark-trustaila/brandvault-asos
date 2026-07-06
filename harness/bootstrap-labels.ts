/**
 * Bootstrap draft labels for the real corpus. Classifies every email ONCE,
 * writes harness/labels.jsonl with the classifier's guesses (for a human to
 * correct), and prints a reviewable table. Local only — real client data.
 *
 *   npx tsx harness/bootstrap-labels.ts
 *
 * Each draft line carries `conf` + `note` (the classifier's confidence and
 * summary) so it's self-describing while you correct registry / type / refs /
 * expectHigh. The harness ignores those extra fields.
 */
import fs from 'fs';
import path from 'path';

(function loadEnv() {
  try {
    for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* rely on shell env */
  }
})();

import { parseEml } from '../lib/eml';
import { classifyEmail } from '../lib/email-classifier';
import { AUTO_ACT_TYPES } from '../lib/email-types';

const CORPUS = 'harness/email-corpus';
const OUT = 'harness/labels.jsonl';
const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n) + ' …[truncated]' : s);

async function main() {
  const files = fs.readdirSync(CORPUS).filter((f) => f.toLowerCase().endsWith('.eml')).sort();
  console.log(`Classifying ${files.length} emails from ${CORPUS} …\n`);

  const seenHash = new Map<string, string>();
  const lines: string[] = [];
  const rows: { i: number; file: string; registry?: string; type?: string; conf?: string; refs?: string[]; note?: string; dup?: string; error?: string }[] = [];

  let i = 0;
  for (const file of files) {
    i++;
    const email = await parseEml(fs.readFileSync(path.join(CORPUS, file)));
    const dup = seenHash.get(email.contentHash);
    if (!dup) seenHash.set(email.contentHash, file);

    try {
      const c = await classifyEmail({
        subject: email.subject,
        bodyText: cap(email.bodyText, 8000),
        attachmentTexts: email.attachments.map((a) => cap(a.extractedText, 6000)).filter(Boolean),
        fromAddress: email.fromAddress,
      });
      const expectHigh = c.confidence === 'high' && AUTO_ACT_TYPES.includes(c.communicationType);
      lines.push(
        JSON.stringify({ file, registry: c.registry, type: c.communicationType, refs: c.referenceNumbers, expectHigh, conf: c.confidence, note: c.summary })
      );
      rows.push({ i, file, registry: c.registry, type: c.communicationType, conf: c.confidence, refs: c.referenceNumbers, note: c.summary, dup });
    } catch (e) {
      lines.push(JSON.stringify({ file, registry: 'unknown', type: 'other', refs: [], expectHigh: false, note: 'CLASSIFIER ERROR' }));
      rows.push({ i, file, error: (e as Error).message, dup });
    }
    process.stdout.write(`  ${i}/${files.length}\r`);
  }

  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(`\nWrote ${lines.length} draft labels to ${OUT}\n`);

  for (const r of rows) {
    const name = r.file.length > 68 ? r.file.slice(0, 65) + '…' : r.file;
    console.log(`${String(r.i).padStart(2)}. ${name}${r.dup ? `   ⧉ DUP of ${r.dup}` : ''}`);
    if (r.error) console.log(`    ERROR: ${r.error}`);
    else {
      console.log(`    registry=${r.registry}  type=${r.type}  conf=${r.conf}${AUTO_ACT_TYPES.includes(r.type as never) ? '  [auto-act]' : ''}`);
      console.log(`    refs=[${(r.refs ?? []).join(', ')}]`);
      console.log(`    ${r.note}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
