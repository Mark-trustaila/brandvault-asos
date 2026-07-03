'use client';

/**
 * Client-side renewal-term rules for the common registries, so mark entry can
 * auto-fill the expiry/renewal date without a DB call. Renewal is generally the
 * base date + 10 years; the base is the filing date for most offices and the
 * registration date for a few. Mirrors the obligation engine in lib/utils.ts.
 */
type RenewalRule = { years: number; from: 'filing' | 'registration' };

const RULES: Record<string, RenewalRule> = {
  UKIPO: { years: 10, from: 'filing' },
  EUIPO: { years: 10, from: 'filing' },
  WIPO: { years: 10, from: 'registration' },
  USPTO: { years: 10, from: 'registration' },
  INPI: { years: 10, from: 'filing' },
  IPOS: { years: 10, from: 'filing' },
  'IP Australia': { years: 10, from: 'filing' },
  CIPO: { years: 10, from: 'registration' },
};

const DEFAULT_RULE: RenewalRule = { years: 10, from: 'filing' };

/** Renewal/expiry date as YYYY-MM-DD, or '' if the needed base date is missing. */
export function computeRenewalDate(
  registry: string,
  filingDate: string,
  registrationDate: string
): string {
  const rule = RULES[registry?.trim()] ?? DEFAULT_RULE;
  const base =
    rule.from === 'registration' ? registrationDate || filingDate : filingDate || registrationDate;
  if (!base) return '';
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + rule.years);
  return d.toISOString().slice(0, 10);
}
