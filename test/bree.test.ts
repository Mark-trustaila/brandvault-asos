import { describe, it, expect } from 'vitest';
import { parseBreeCommand } from '../lib/bree-commands';
import { alertBucket, daysUntil, DEFAULT_THRESHOLDS } from '../lib/alerts';
import { verifySlackSignature } from '../lib/slack';
import * as bree from '../lib/bree-messages';
import crypto from 'crypto';

describe('parseBreeCommand', () => {
  it('empty / whitespace -> help', () => {
    expect(parseBreeCommand('')).toEqual({ kind: 'help' });
    expect(parseBreeCommand('   ')).toEqual({ kind: 'help' });
  });
  it('recognises each verb, case-insensitively', () => {
    expect(parseBreeCommand('portfolio')).toEqual({ kind: 'portfolio' });
    expect(parseBreeCommand('RENEWALS')).toEqual({ kind: 'renewals' });
    expect(parseBreeCommand('Help')).toEqual({ kind: 'help' });
  });
  it('status captures the multi-word query', () => {
    expect(parseBreeCommand('status ACME')).toEqual({ kind: 'status', query: 'ACME' });
    expect(parseBreeCommand('status  big  brand ')).toEqual({ kind: 'status', query: 'big brand' });
    expect(parseBreeCommand('status')).toEqual({ kind: 'status', query: '' });
  });
  it('anything else -> unknown', () => {
    expect(parseBreeCommand('wat')).toEqual({ kind: 'unknown', input: 'wat' });
  });
});

describe('alertBucket', () => {
  const T = DEFAULT_THRESHOLDS.slice().sort((a, b) => b - a); // [180,90,30]
  it('returns the tightest crossed threshold index', () => {
    expect(alertBucket(210, T)).toBe(-1); // further out than all
    expect(alertBucket(180, T)).toBe(0);
    expect(alertBucket(170, T)).toBe(0);
    expect(alertBucket(90, T)).toBe(1);
    expect(alertBucket(88, T)).toBe(1);
    expect(alertBucket(30, T)).toBe(2);
    expect(alertBucket(5, T)).toBe(2); // very close still maps to tightest
    expect(alertBucket(0, T)).toBe(2);
  });
  it('respects custom thresholds', () => {
    expect(alertBucket(150, [200, 100, 40])).toBe(0);
    expect(alertBucket(50, [200, 100, 40])).toBe(1);
    expect(alertBucket(20, [200, 100, 40])).toBe(2);
  });
});

describe('daysUntil', () => {
  it('floors the day difference', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(daysUntil(new Date('2026-01-31T00:00:00Z'), now)).toBe(30);
    expect(daysUntil(new Date('2026-01-01T23:00:00Z'), now)).toBe(0);
  });
});

describe('verifySlackSignature', () => {
  const secret = 'shhh';
  const body = 'token=x&team_id=T1&text=portfolio';
  const ts = '1700000000';
  const sign = (t: string, b: string, s = secret) =>
    'v0=' + crypto.createHmac('sha256', s).update(`v0:${t}:${b}`).digest('hex');

  it('accepts a valid, fresh signature', () => {
    const signature = sign(ts, body);
    expect(verifySlackSignature({ signingSecret: secret, timestamp: ts, body, signature, now: Number(ts) + 10 })).toBe(true);
  });
  it('rejects a tampered body', () => {
    const signature = sign(ts, body);
    expect(verifySlackSignature({ signingSecret: secret, timestamp: ts, body: body + '&evil=1', signature, now: Number(ts) })).toBe(false);
  });
  it('rejects a stale timestamp (replay)', () => {
    const signature = sign(ts, body);
    expect(verifySlackSignature({ signingSecret: secret, timestamp: ts, body, signature, now: Number(ts) + 400 })).toBe(false);
  });
  it('rejects the wrong secret and missing fields', () => {
    expect(verifySlackSignature({ signingSecret: secret, timestamp: ts, body, signature: sign(ts, body, 'other'), now: Number(ts) })).toBe(false);
    expect(verifySlackSignature({ signingSecret: '', timestamp: ts, body, signature: sign(ts, body), now: Number(ts) })).toBe(false);
  });
});

describe('bree message formatters', () => {
  it('every message is signed "Bree · BrandVault"', () => {
    const msgs = [
      bree.renewalAlert({ markText: 'ASOS', registry: 'UKIPO', type: 'Renewal', dueDate: '2026-09-01', daysRemaining: 30 }),
      bree.statusChange({ markText: 'ASOS', registry: 'UKIPO', from: 'Pending', to: 'Registered' }),
      bree.weeklyDigest({ companyName: 'ASOS', upcoming: [] }),
      bree.portfolioSummary({ companyName: 'ASOS', total: 81, registered: 70, pending: 5, published: 6, needsAttention: 3 }),
      bree.renewalsList({ items: [] }),
      bree.markStatusMsg({ query: 'ASOS', groups: [{ markText: 'ASOS', rows: [{ registry: 'UKIPO', status: 'Registered' }] }] }),
      bree.help(),
    ];
    for (const m of msgs) {
      const last = m.blocks[m.blocks.length - 1] as { elements: { text: string }[] };
      expect(last.elements[0].text).toBe('Bree · BrandVault');
      expect(m.text.length).toBeGreaterThan(0);
    }
  });
  it('renewal alert carries the mark, registry and days in the fallback text', () => {
    const m = bree.renewalAlert({ markText: 'ASOS', registry: 'EUIPO', type: 'Renewal', dueDate: '2026-09-01', daysRemaining: 30 });
    expect(m.text).toContain('ASOS');
    expect(m.text).toContain('EUIPO');
    expect(m.text).toContain('30');
  });

  it('markStatusMsg lists one line per registry and summarises the count', () => {
    const m = bree.markStatusMsg({
      query: 'asos',
      groups: [
        {
          markText: 'ASOS',
          rows: [
            { registry: 'UKIPO', status: 'Registered', nextDeadline: { type: 'Renewal', dueDate: '2030-06-01', daysRemaining: 1426 } },
            { registry: 'EUIPO', status: 'Registered' },
            { registry: 'USPTO', status: 'Pending' },
          ],
        },
      ],
    });
    const flat = JSON.stringify(m.blocks);
    expect(flat).toContain('UKIPO');
    expect(flat).toContain('EUIPO');
    expect(flat).toContain('USPTO');
    expect(flat).toContain('no upcoming deadline'); // EUIPO row has no deadline
    expect(m.text).toContain('3 registrations'); // one group, three registries
  });
});
