import { describe, it, expect } from 'vitest';
import { refCore, parseLooseDate } from '../lib/email-processor';
import * as bree from '../lib/bree-messages';

describe('refCore (reference matching)', () => {
  it('reduces UKIPO variants to the same core', () => {
    expect(refCore('UK00003205169')).toBe('3205169');
    expect(refCore('00003205169')).toBe('3205169');
    expect(refCore('3205169')).toBe('3205169');
  });
  it('reduces EUTM leading zero', () => {
    expect(refCore('018123456')).toBe('18123456');
    expect(refCore('EU018123456')).toBe('18123456');
  });
  it('strips WIPO / IR prefixes and punctuation', () => {
    expect(refCore('IR 1234567')).toBe('1234567');
    expect(refCore('WO0000001899007')).toBe('1899007');
  });
});

describe('parseLooseDate', () => {
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  it('parses the formats the classifier emits', () => {
    expect(iso(parseLooseDate('05 January 2027'))).toBe('2027-01-05');
    expect(iso(parseLooseDate('2026-09-01'))).toBe('2026-09-01');
    expect(iso(parseLooseDate('January 5, 2027'))).toBe('2027-01-05');
    expect(iso(parseLooseDate('20 July 2026'))).toBe('2026-07-20');
    expect(iso(parseLooseDate('05/01/2027'))).toBe('2027-01-05');
  });
  it('returns null for unparseable text', () => {
    expect(parseLooseDate('sometime next year')).toBeNull();
    expect(parseLooseDate('')).toBeNull();
  });
});

describe('inbound-email formatters', () => {
  const sig = (m: { blocks: unknown[] }) => JSON.stringify(m.blocks);
  it('all are signed Bree · BrandVault', () => {
    const msgs = [
      bree.emailRegistered({ markText: 'ACME', registry: 'UKIPO', renewalDate: '2036-01-01' }),
      bree.renewalReconcileMatch({ markText: 'ACME', registry: 'UKIPO', dueDate: '2027-01-05' }),
      bree.renewalReconcileMismatch({ markText: 'ACME', registry: 'UKIPO', ourDate: '2027-01-05', theirDate: '2026-09-01' }),
      bree.renewalCompleted({ markText: 'ACME', registry: 'EUIPO', dueDate: '2026-05-18' }),
      bree.emailAlert({ type: 'opposition_notice', urgency: 'high', markText: 'ACME', registry: 'UKIPO', deadline: '2026-07-28' }),
      bree.unmatchedNotice({ subject: 'Renewal reminder', refs: ['UK00003205169'] }),
    ];
    for (const m of msgs) expect(sig(m)).toContain('Bree · BrandVault');
  });
  it('mismatch alert surfaces both dates and a warning', () => {
    const m = bree.renewalReconcileMismatch({ markText: 'ACME', registry: 'UKIPO', ourDate: '2027-01-05', theirDate: '2026-09-01' });
    expect(m.text).toContain('MISMATCH');
    expect(sig(m)).toContain('2026-09-01');
    expect(sig(m)).toContain('2027-01-05');
  });
  it('cancellation alert never implies the record was changed', () => {
    const m = bree.emailAlert({ type: 'cancellation_notice', urgency: 'high', markText: 'ACME', registry: 'UKIPO' });
    expect(sig(m)).toContain('NOT been changed');
  });
});
