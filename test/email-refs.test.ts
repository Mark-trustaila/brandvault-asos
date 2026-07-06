import { describe, it, expect } from 'vitest';
import { extractRefs, extractRefStrings } from '../lib/email-refs';

describe('extractRefs', () => {
  it('extracts a full UKIPO number', () => {
    const r = extractRefs('Trade mark UK00003456789 registered');
    expect(r).toEqual([{ raw: 'UK00003456789', normalized: 'UK00003456789', registry: 'UKIPO' }]);
  });

  it('normalizes a bare UKIPO application number to canonical form', () => {
    const r = extractRefs('application number 3123456 refers');
    expect(r[0]).toMatchObject({ registry: 'UKIPO', normalized: 'UK00003123456' });
  });

  it('extracts a 9-digit EUTM number', () => {
    expect(extractRefs('EUTM 018123456').map((x) => x.registry)).toEqual(['EUIPO']);
    expect(extractRefs('EUTM 018123456')[0].normalized).toBe('018123456');
  });

  it('extracts a WIPO international registration', () => {
    expect(extractRefs('IR 1234567 designates')[0]).toMatchObject({ registry: 'WIPO', normalized: 'IR1234567' });
    expect(extractRefs('IR1234567')[0].registry).toBe('WIPO');
  });

  it('does not double-count a full UKIPO number as a bare number', () => {
    const r = extractRefs('UK00003456789');
    expect(r).toHaveLength(1);
    expect(r[0].registry).toBe('UKIPO');
  });

  it('does not misread a 9-digit EUTM as a bare UKIPO number', () => {
    const r = extractRefs('018123456');
    expect(r).toHaveLength(1);
    expect(r[0].registry).toBe('EUIPO');
  });

  it('finds refs across multiple text sources (body + attachment) and de-dupes', () => {
    const refs = extractRefStrings('see UK00003456789', 'attachment: UK00003456789 and 018222333');
    expect(refs).toContain('UK00003456789');
    expect(refs).toContain('018222333');
    expect(refs.filter((r) => r === 'UK00003456789')).toHaveLength(1);
  });

  it('returns nothing for text with no references', () => {
    expect(extractRefs('Please log in to your User Area to view the communication.')).toEqual([]);
  });
});
