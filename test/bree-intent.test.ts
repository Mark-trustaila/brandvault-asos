import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma mock (resolveMarkNames + firstMarkId). Hoisted so the vi.mock factory
// can reference the same fn instances the tests configure.
const { findMany, findFirst } = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn() }));
vi.mock('../lib/db', () => ({ prisma: { trademark: { findMany, findFirst } } }));

// answerBree mock — echo the command kind (this tests ROUTING, not the data).
vi.mock('../lib/bree-service', () => ({
  answerBree: vi.fn(async (_companyId: string, cmd: { kind: string; query?: string }) => ({ kind: cmd.kind, query: cmd.query, groups: [], items: [] })),
}));

import { handleBreeQuery, type ClassifyFn } from '../lib/bree-web';

const intent = (i: string, markText?: string): ClassifyFn => async () => ({ intent: i as never, markText });

beforeEach(() => {
  findMany.mockReset().mockResolvedValue([]);
  findFirst.mockReset().mockResolvedValue(null);
});

describe('handleBreeQuery — NL intent routing', () => {
  it('portfolio → routes to the portfolio handler', async () => {
    const o = await handleBreeQuery('c1', "how's the portfolio", intent('portfolio'));
    expect(o.reply.kind).toBe('portfolio');
    expect(o.resolvedIntent).toBe('portfolio');
    expect(o.fallback).toBe(false);
  });

  it('renewals → routes to the renewals handler', async () => {
    const o = await handleBreeQuery('c1', 'anything coming up for renewal', intent('renewals'));
    expect(o.reply.kind).toBe('renewals');
    expect(o.resolvedIntent).toBe('renewals');
  });

  it('status with a match → routes to status, records the mark', async () => {
    findMany.mockResolvedValue([{ markText: 'ASOS' }]);
    findFirst.mockResolvedValue({ id: 'tm1' });
    const o = await handleBreeQuery('c1', 'status of ASOS', intent('status', 'ASOS'));
    expect(o.reply.kind).toBe('status');
    expect(o.matchedTrademarkId).toBe('tm1');
  });

  it('status ambiguous → clarify, listing the candidate marks', async () => {
    findMany.mockResolvedValue([{ markText: 'ASOS AI' }, { markText: 'ASOS CARE' }]); // both contain "asos", none exact
    const o = await handleBreeQuery('c1', 'status of asos', intent('status', 'asos'));
    expect(o.reply.kind).toBe('clarify');
    expect((o.reply as { options: string[] }).options).toEqual(['ASOS AI', 'ASOS CARE']);
    expect(o.matchedTrademarkId).toBeNull();
  });

  it('unsupported → capability outcome, no fallback flag', async () => {
    const o = await handleBreeQuery('c1', 'file a new trademark for me', intent('unsupported'));
    expect(o.reply.kind).toBe('unsupported');
    expect(o.resolvedIntent).toBe('unsupported');
    expect(o.fallback).toBe(false);
  });

  it('classifier failure/timeout → unsupported with fallback=true', async () => {
    const throwing: ClassifyFn = async () => {
      throw new Error('timeout');
    };
    const o = await handleBreeQuery('c1', 'anything', throwing);
    expect(o.reply.kind).toBe('unsupported');
    expect(o.fallback).toBe(true);
  });
});
