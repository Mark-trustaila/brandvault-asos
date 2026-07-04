import { describe, it, expect } from 'vitest';
import {
  computeRenewalDate,
  normalizeRegistry,
  getRegistryRule,
  addTerm,
  renewalTermYears,
} from '../lib/renewal-rules';

const REGISTRATION_BASED = ['USPTO', 'CNIPA', 'JPO', 'KIPO', 'CIPO', 'INPIBR'];
const ALL_CODES = [
  'UKIPO', 'EUIPO', 'USPTO', 'CNIPA', 'JPO', 'KIPO', 'IPINDIA', 'INPIBR', 'IMPI', 'CIPO',
  'IPAU', 'IPOS', 'IPONZ', 'INPIFR', 'DPMA', 'BOIP', 'TURKPATENT', 'SAIP', 'UAEMOE', 'DGIP', 'WIPO',
];

describe('config coverage', () => {
  it('has all 20 registries + WIPO', () => {
    for (const code of ALL_CODES) expect(getRegistryRule(code), code).not.toBeNull();
    expect(ALL_CODES).toHaveLength(21);
  });

  it('resolves aliases', () => {
    expect(normalizeRegistry('IP Australia')).toBe('IPAU');
    expect(normalizeRegistry('INPI')).toBe('INPIBR');
    expect(normalizeRegistry('WIPO')).toBe('WIPO');
    expect(normalizeRegistry('UKIPO')).toBe('UKIPO'); // pass-through
  });

  it('returns null for unknown registries', () => {
    expect(getRegistryRule('NOT_A_REGISTRY')).toBeNull();
  });
});

describe('base date selection (term_from)', () => {
  // filing 2010, registration 2020 — the result year reveals which base was used.
  // (registration 2020 is post-cutoff so Canada's 15yr transitional doesn't apply.)
  it.each(REGISTRATION_BASED)('%s renews from registration (=> 2030)', (code) => {
    expect(computeRenewalDate(code, '2010-01-01', '2020-01-01')).toBe('2030-01-01');
  });

  it.each(['UKIPO', 'EUIPO', 'IPAU', 'IPOS', 'INPIFR', 'DPMA', 'IMPI'])(
    '%s renews from filing (=> 2020)',
    (code) => {
      expect(computeRenewalDate(code, '2010-01-01', '2015-01-01')).toBe('2020-01-01');
    }
  );
});

describe('special cases', () => {
  it('Canada: pre-2019-06-17 registration gets a 15-year term', () => {
    expect(computeRenewalDate('CIPO', '', '2018-01-01')).toBe('2033-01-01');
  });
  it('Canada: on/after 2019-06-17 gets 10-year term', () => {
    expect(computeRenewalDate('CIPO', '', '2020-01-01')).toBe('2030-01-01');
  });
  it('Saudi Arabia: Hijri term lands ~111 days short of a Gregorian decade', () => {
    const d = computeRenewalDate('SAIP', '2015-01-01', '');
    expect(d.startsWith('2024')).toBe(true);
    const days = (new Date('2025-01-01').getTime() - new Date(d).getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(100);
    expect(days).toBeLessThan(125);
  });
});

describe('missing / unknown data', () => {
  it('returns "" when the required base date is missing', () => {
    expect(computeRenewalDate('UKIPO', '', '2016-01-01')).toBe(''); // filing-based, no filing
    expect(computeRenewalDate('USPTO', '2016-01-01', '')).toBe(''); // reg-based, no reg
  });
  it('returns "" for an unknown registry', () => {
    expect(computeRenewalDate('NOPE', '2015-01-01', '2016-01-01')).toBe('');
  });
});

describe('aliases end-to-end', () => {
  it('INPI resolves to Brazil (registration-based)', () => {
    expect(computeRenewalDate('INPI', '2015-01-01', '2017-01-01')).toBe('2027-01-01');
  });
  it('IP Australia resolves to IPAU (filing-based)', () => {
    expect(computeRenewalDate('IP Australia', '2015-01-01', '2016-01-01')).toBe('2025-01-01');
  });
  it('WIPO is carried forward (registration-based)', () => {
    expect(computeRenewalDate('WIPO', '2015-01-01', '2016-01-01')).toBe('2026-01-01');
  });
});

describe('addTerm', () => {
  it('adds whole Gregorian years', () => {
    expect(addTerm(new Date('2015-01-01'), 10).toISOString().slice(0, 10)).toBe('2025-01-01');
  });
  it('adds fractional years as months (3.25 => +3y +3m)', () => {
    expect(addTerm(new Date('2015-01-01'), 3.25).toISOString().slice(0, 10)).toBe('2018-04-01');
  });
  it('Hijri years are shorter than Gregorian', () => {
    const greg = addTerm(new Date('2015-01-01'), 10).getTime();
    const hijri = addTerm(new Date('2015-01-01'), 10, 'hijri').getTime();
    expect(hijri).toBeLessThan(greg);
  });
});

describe('renewalTermYears', () => {
  it('applies the transitional term only before the cutoff', () => {
    const cipo = getRegistryRule('CIPO')!;
    expect(renewalTermYears(cipo, new Date('2018-01-01'))).toBe(15);
    expect(renewalTermYears(cipo, new Date('2020-01-01'))).toBe(10);
    expect(renewalTermYears(cipo, null)).toBe(10);
  });
});
