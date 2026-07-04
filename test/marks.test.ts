import { describe, it, expect } from 'vitest';
import { buildMarkData, MARK_STATUSES } from '../lib/marks';

describe('buildMarkData — create (partial: false)', () => {
  it('requires markText, registryName, status', () => {
    expect(buildMarkData({ registryName: 'UKIPO', status: 'Pending' }, { partial: false }).error).toMatch(/markText/);
    expect(buildMarkData({ markText: 'X', status: 'Pending' }, { partial: false }).error).toMatch(/registryName/);
    expect(buildMarkData({ markText: 'X', registryName: 'UKIPO' }, { partial: false }).error).toMatch(/status/);
  });

  it('rejects an invalid status', () => {
    const r = buildMarkData({ markText: 'X', registryName: 'UKIPO', status: 'Bogus' }, { partial: false });
    expect(r.error).toMatch(/status must be one of/);
  });

  it('accepts every valid status', () => {
    for (const status of MARK_STATUSES) {
      expect(buildMarkData({ markText: 'X', registryName: 'UKIPO', status }, { partial: false }).error).toBeUndefined();
    }
  });

  it('coerces dates and keeps required fields', () => {
    const { data, error } = buildMarkData(
      { markText: 'ASOS', registryName: 'UKIPO', status: 'Registered', filingDate: '2020-01-01' },
      { partial: false }
    );
    expect(error).toBeUndefined();
    expect(data!.markText).toBe('ASOS');
    expect(data!.filingDate).toBeInstanceOf(Date);
  });

  it('rejects a non-object body', () => {
    expect(buildMarkData(null, { partial: false }).error).toBeTruthy();
    expect(buildMarkData('nope', { partial: false }).error).toBeTruthy();
  });
});

describe('buildMarkData — update (partial: true)', () => {
  it('allows a subset of fields', () => {
    const { data, error } = buildMarkData({ status: 'Registered' }, { partial: true });
    expect(error).toBeUndefined();
    expect(data!.status).toBe('Registered');
    expect(data!.markText).toBeUndefined();
  });

  it('allows an empty patch', () => {
    expect(buildMarkData({}, { partial: true }).error).toBeUndefined();
  });

  it('clears an optional field when set to null', () => {
    const { data } = buildMarkData({ applicationNumber: null }, { partial: true });
    expect(data!.applicationNumber).toBeNull();
  });

  it('still validates status when provided', () => {
    expect(buildMarkData({ status: 'Nope' }, { partial: true }).error).toMatch(/status/);
  });
});
