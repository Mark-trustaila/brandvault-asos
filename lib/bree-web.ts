/**
 * Web-input routing for Bree: classify free text → route to the existing
 * read-only handlers (answerBree), unchanged. Adds two web-only outcomes:
 * `clarify` (ambiguous mark name) and `unsupported`. `classify` is injected so
 * tests are deterministic and don't hit the API.
 */
import { prisma } from './db';
import { answerBree, type BreeAnswer } from './bree-service';
import type { BreeIntent } from './bree-intent';

export type BreeReply = BreeAnswer | { kind: 'unsupported' } | { kind: 'clarify'; query: string; options: string[] };

export type ClassifyFn = (text: string) => Promise<BreeIntent>;

export type BreeQueryOutcome = {
  reply: BreeReply;
  resolvedIntent: string; // portfolio | renewals | status | unsupported
  matchedTrademarkId: string | null;
  fallback: boolean; // true when the classifier errored/timed out
};

// Distinct company mark names matching `name`: exact (case-insensitive) wins;
// otherwise substring matches. Tolerant partial matching per spec.
async function resolveMarkNames(companyId: string, name: string): Promise<{ exact: string[]; partial: string[] }> {
  const q = name.trim().toLowerCase();
  if (!q) return { exact: [], partial: [] };
  const rows = await prisma.trademark.findMany({ where: { companyId }, select: { markText: true }, distinct: ['markText'], orderBy: { markText: 'asc' } });
  const names = rows.map((r) => r.markText);
  return { exact: names.filter((n) => n.toLowerCase() === q), partial: names.filter((n) => n.toLowerCase().includes(q)) };
}

async function firstMarkId(companyId: string, markText: string): Promise<string | null> {
  const m = await prisma.trademark.findFirst({ where: { companyId, markText }, select: { id: true } });
  return m?.id ?? null;
}

export async function handleBreeQuery(companyId: string, text: string, classify: ClassifyFn): Promise<BreeQueryOutcome> {
  let intent: BreeIntent['intent'] = 'unsupported';
  let markText: string | undefined;
  let fallback = false;
  try {
    const r = await classify(text);
    intent = r.intent;
    markText = r.markText;
  } catch {
    intent = 'unsupported';
    fallback = true; // API failure/timeout → capability message, never a raw error
  }

  if (intent === 'portfolio') return { reply: await answerBree(companyId, { kind: 'portfolio' }), resolvedIntent: 'portfolio', matchedTrademarkId: null, fallback };
  if (intent === 'renewals') return { reply: await answerBree(companyId, { kind: 'renewals' }), resolvedIntent: 'renewals', matchedTrademarkId: null, fallback };

  if (intent === 'status') {
    const name = (markText ?? '').trim();
    const { exact, partial } = await resolveMarkNames(companyId, name);
    // Ambiguous: no exact match but several distinct partial matches → ask.
    if (exact.length === 0 && partial.length > 1) {
      return { reply: { kind: 'clarify', query: name, options: partial }, resolvedIntent: 'status', matchedTrademarkId: null, fallback };
    }
    const chosen = exact[0] ?? partial[0] ?? name; // exact wins; else the single partial; else let status report "not found"
    const reply = await answerBree(companyId, { kind: 'status', query: chosen });
    const matchedTrademarkId = exact[0] || partial.length === 1 ? await firstMarkId(companyId, chosen) : null;
    return { reply, resolvedIntent: 'status', matchedTrademarkId, fallback };
  }

  return { reply: { kind: 'unsupported' }, resolvedIntent: 'unsupported', matchedTrademarkId: null, fallback };
}
