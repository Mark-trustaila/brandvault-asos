import rulesData from '../config/renewal-rules.json';

/**
 * Config-driven renewal rules (config/renewal-rules.json) — single source of
 * truth for both the deadline engine (lib/utils.ts) and the bulk-entry expiry
 * auto-fill. Client-safe, bundled — no DB call. Adding a registry is a config
 * edit, not a code change.
 */
export type BaseDate = 'filing' | 'registration';

export type ObligationRule = {
  type: string;
  base: BaseDate;
  dueYears: number; // deadline offset from base (fractional allowed)
  windowMonths?: number; // early-filing window before the deadline
  critical?: boolean;
  recurringYears?: number; // repeats every N years if set
  appliesAfter?: string; // only if registration date >= this ISO date
};

export type RegistryRule = {
  name?: string;
  termYears: number;
  termFrom: BaseDate;
  calendar?: 'gregorian' | 'hijri';
  earlyWindowMonths: number;
  graceMonths?: number;
  transitional?: { beforeDate: string; termYears: number };
  obligations?: ObligationRule[];
};

type RulesFile = { aliases: Record<string, string>; registries: Record<string, RegistryRule> };

const RULES = rulesData as unknown as RulesFile;

const HIJRI_YEAR_DAYS = 354.37; // approximation per the source file
const MS_PER_DAY = 86_400_000;

/** Map a mark's registry_name to a config code (via alias, else as-is). */
export function normalizeRegistry(registryName: string): string {
  const n = (registryName ?? '').trim();
  return RULES.aliases[n] ?? n;
}

export function getRegistryRule(registryName: string): RegistryRule | null {
  return RULES.registries[normalizeRegistry(registryName)] ?? null;
}

/** Add a term to a base date, honouring the Hijri calendar and fractional years. */
export function addTerm(base: Date, years: number, calendar?: string): Date {
  if (calendar === 'hijri') {
    return new Date(base.getTime() + years * HIJRI_YEAR_DAYS * MS_PER_DAY);
  }
  const d = new Date(base);
  const whole = Math.trunc(years);
  const months = Math.round((years - whole) * 12);
  d.setFullYear(d.getFullYear() + whole);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** The primary renewal term for a mark, applying any transitional rule (e.g. Canada pre-2019). */
export function renewalTermYears(rule: RegistryRule, registrationDate: Date | null): number {
  if (rule.transitional && registrationDate && registrationDate < new Date(rule.transitional.beforeDate)) {
    return rule.transitional.termYears;
  }
  return rule.termYears;
}

/**
 * Expiry/renewal date as YYYY-MM-DD for mark-entry auto-fill, or '' if the
 * required base date is missing. Uses the same config as the deadline engine.
 */
export function computeRenewalDate(
  registryName: string,
  filingDate: string,
  registrationDate: string
): string {
  const rule = getRegistryRule(registryName);
  if (!rule) return '';
  const regDate = registrationDate ? new Date(registrationDate) : null;
  const baseStr = rule.termFrom === 'registration' ? registrationDate : filingDate;
  if (!baseStr) return '';
  const base = new Date(baseStr);
  if (Number.isNaN(base.getTime())) return '';
  return addTerm(base, renewalTermYears(rule, regDate), rule.calendar).toISOString().slice(0, 10);
}
