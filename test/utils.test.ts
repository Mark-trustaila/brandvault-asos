import { describe, it, expect } from 'vitest';
import type { Trademark } from '../types/trademark';
import {
  getObligationsForTrademark,
  matchesSearch,
  calculateDaysRemaining,
  getInitials,
  getDaysBadgeStyle,
  getStatusStyle,
} from '../lib/utils';

const mark = (registry_name: string, filing: string | null, reg: string | null): Trademark =>
  ({ registry_name, filing_date: filing, registration_date: reg } as unknown as Trademark);

describe('getObligationsForTrademark', () => {
  it('returns nothing for an unknown registry', () => {
    expect(getObligationsForTrademark(mark('NOPE', '2020-01-01', '2021-01-01'))).toHaveLength(0);
  });

  it('produces a renewal obligation for a known registry', () => {
    const obs = getObligationsForTrademark(mark('UKIPO', '2020-01-01', '2021-01-01'));
    expect(obs.some((o) => o.type === 'Renewal' && !o.uncertain)).toBe(true);
  });

  it('includes USPTO Section 8 for a recent registration', () => {
    const obs = getObligationsForTrademark(mark('USPTO', '2020-01-01', '2021-06-01'));
    expect(obs.some((o) => /Section 8/.test(o.type))).toBe(true);
  });

  it('flags uncertainty when the required base date is missing', () => {
    const obs = getObligationsForTrademark(mark('UKIPO', null, '2016-01-01')); // filing-based, no filing
    const u = obs.find((o) => o.uncertain);
    expect(u).toBeTruthy();
    expect(u!.dueDate).toBeNull();
    expect(u!.desc).toMatch(/filing date required/);
  });

  it('sorts uncertain obligations last', () => {
    const obs = getObligationsForTrademark(mark('UKIPO', null, '2016-01-01'));
    if (obs.length > 1) expect(obs[obs.length - 1].uncertain).toBe(true);
  });
});

describe('matchesSearch', () => {
  const tm = { mark_text: 'ASOS', registry_name: 'UKIPO', application_number: 'UK123', status: 'Registered' } as Trademark;
  it('matches on empty query', () => expect(matchesSearch(tm, '')).toBe(true));
  it('matches mark text case-insensitively', () => expect(matchesSearch(tm, 'asos')).toBe(true));
  it('matches registry', () => expect(matchesSearch(tm, 'ukipo')).toBe(true));
  it('does not match unrelated text', () => expect(matchesSearch(tm, 'zzz')).toBe(false));
});

describe('calculateDaysRemaining', () => {
  it('returns 9999 when no expiry', () => expect(calculateDaysRemaining(undefined)).toBe(9999));
  it('is negative for a past date', () => expect(calculateDaysRemaining('2000-01-01')).toBeLessThan(0));
});

describe('getInitials', () => {
  it('takes the first two words', () => expect(getInitials('Mark Kingsley-Williams')).toBe('MK'));
  it('handles empty input', () => expect(getInitials('')).toBe('NA'));
});

describe('getDaysBadgeStyle thresholds', () => {
  it('<=90 days is red', () => expect(getDaysBadgeStyle(30).color).toBe('#eb5757'));
  it('<=180 days is amber', () => expect(getDaysBadgeStyle(150).color).toBe('#fff'));
  it('<=365 days is green', () => expect(getDaysBadgeStyle(300).color).toBe('#0f7b6c'));
  it('formats the label', () => expect(getDaysBadgeStyle(42).text).toBe('42d'));
});

describe('getStatusStyle', () => {
  it('maps Registered to green', () => expect(getStatusStyle('Registered').color).toBe('#0f7b6c'));
  it('falls back for unknown status', () => expect(getStatusStyle('Whatever').color).toBe('#9b9a97'));
});
