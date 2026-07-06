/**
 * Deterministic trademark reference-number extraction. Content-first
 * classification still routes on the LLM, but reference numbers are the
 * strongest *matching* signal, so we pull them with regex rather than trusting
 * the model alone — the classifier's refs get unioned/validated against these.
 *
 * Formats (per the Phase 4 spec):
 *   UKIPO — UK00003123456  or bare 3123456 (7–8 digit application no.)
 *   EUTM  — 018123456      (9-digit EU trade mark no., historically 0-led)
 *   WIPO  — IR 1234567      (international registration)
 */

export type RefRegistry = 'UKIPO' | 'EUIPO' | 'WIPO';
export type ExtractedRef = { raw: string; normalized: string; registry: RefRegistry };

// UK00003123456 (UK + 11 digits) — canonical UKIPO number.
const UKIPO_FULL = /\bUK\s?0{2,}\d{6,9}\b/gi;
// WIPO international registration: IR 1234567 / IR1234567.
const WIPO = /\bIR\s?\d{6,8}\b/gi;
// EUTM: 9-digit number, historically starting 0 (e.g. 018123456). Word-bounded
// so we don't grab arbitrary long digit runs.
const EUTM = /\b0\d{8}\b/g;
// Bare UKIPO application number: 7–8 digits not already part of a longer run.
const UKIPO_BARE = /\b\d{7,8}\b/g;

const digits = (s: string) => s.replace(/\D/g, '');

function push(map: Map<string, ExtractedRef>, ref: ExtractedRef) {
  // De-dupe on normalized+registry.
  const key = `${ref.registry}:${ref.normalized}`;
  if (!map.has(key)) map.set(key, ref);
}

/**
 * Extract and normalize all reference numbers found in the given text.
 * Order matters: match the specific, unambiguous formats first and remove them
 * before the greedy bare-number pass, so "UK00003123456" isn't also read as a
 * bare "3123456" and "018123456" isn't double-counted.
 */
export function extractRefs(...texts: (string | undefined | null)[]): ExtractedRef[] {
  const map = new Map<string, ExtractedRef>();
  let joined = texts.filter(Boolean).join('\n');

  for (const m of joined.match(UKIPO_FULL) ?? []) {
    push(map, { raw: m.trim(), normalized: 'UK' + digits(m).padStart(11, '0').slice(-11), registry: 'UKIPO' });
  }
  joined = joined.replace(UKIPO_FULL, ' ');

  for (const m of joined.match(WIPO) ?? []) {
    push(map, { raw: m.trim(), normalized: 'IR' + digits(m), registry: 'WIPO' });
  }
  joined = joined.replace(WIPO, ' ');

  for (const m of joined.match(EUTM) ?? []) {
    push(map, { raw: m.trim(), normalized: digits(m), registry: 'EUIPO' });
  }
  joined = joined.replace(EUTM, ' ');

  for (const m of joined.match(UKIPO_BARE) ?? []) {
    push(map, { raw: m.trim(), normalized: 'UK' + digits(m).padStart(11, '0'), registry: 'UKIPO' });
  }

  return Array.from(map.values());
}

/** Convenience: just the normalized strings. */
export function extractRefStrings(...texts: (string | undefined | null)[]): string[] {
  return extractRefs(...texts).map((r) => r.normalized);
}
