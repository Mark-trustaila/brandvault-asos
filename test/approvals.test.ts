import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Prisma mock — hoisted so the vi.mock factory shares the fn instances.
const db = vi.hoisted(() => ({
  approval: { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
  deadline: { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  trademark: { findUnique: vi.fn(), update: vi.fn() },
  inboundEmail: { update: vi.fn() },
}));
vi.mock('../lib/db', () => ({ prisma: db }));
vi.mock('../lib/audit', () => ({ writeAudit: vi.fn(async () => ({})) }));
vi.mock('../lib/deadlines', () => ({ recalcDeadlines: vi.fn(async () => ({ persisted: 2, needsData: false })) }));

import { proposeApproval, applyApproval, rejectApproval } from '../lib/approvals';
import { autoActEnabled } from '../lib/email-config';

const renewalApproval = {
  id: 'a1', companyId: 'c1', actionType: 'renewal_confirmation', trademarkId: 'tm1', inboundEmailId: 'e1',
  payloadJson: { kind: 'renewal_confirmation', deadlineId: 'd1', dueDate: '2027-01-15' },
  trademark: { markText: 'FACE + BODY', registryName: 'EUIPO' },
};
const decider = { slackUserId: 'U1', slackUserName: 'mark' };

beforeEach(() => {
  Object.values(db).forEach((m) => Object.values(m).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset()));
  db.inboundEmail.update.mockResolvedValue({});
});

describe('proposeApproval', () => {
  it('creates a pending approval and does not mutate mark data', async () => {
    db.approval.create.mockResolvedValue({ id: 'a9' });
    const ap = await proposeApproval({
      companyId: 'c1', inboundEmailId: 'e1', trademarkId: 'tm1', actionType: 'renewal_confirmation',
      summary: 's', payload: { kind: 'renewal_confirmation', deadlineId: 'd1', dueDate: '2027-01-15' },
    });
    expect(ap.id).toBe('a9');
    expect(db.approval.create).toHaveBeenCalledOnce();
    expect(db.deadline.update).not.toHaveBeenCalled();
    expect(db.trademark.update).not.toHaveBeenCalled();
  });
});

describe('applyApproval — renewal_confirmation', () => {
  it('completes the renewal deadline only after approval', async () => {
    db.approval.updateMany.mockResolvedValue({ count: 1 });
    db.approval.findUnique.mockResolvedValue(renewalApproval);
    db.deadline.findUnique.mockResolvedValue({ id: 'd1', completedAt: null, dueDate: new Date('2027-01-15') });
    db.deadline.update.mockResolvedValue({});
    const r = await applyApproval('a1', decider);
    expect(r.status).toBe('approved');
    expect(db.deadline.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'd1' } }));
    expect(r.effect).toContain('marked complete');
    // the source email is closed out
    expect(db.inboundEmail.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'processed' }) }));
  });

  it('is idempotent — a second click applies nothing', async () => {
    db.approval.updateMany.mockResolvedValue({ count: 0 }); // lost the race
    db.approval.findUnique.mockResolvedValue({ ...renewalApproval, status: 'approved' });
    const r = await applyApproval('a1', decider);
    expect(r.status).toBe('already_decided');
    expect(db.deadline.update).not.toHaveBeenCalled();
  });

  it('never completes a deadline that is already complete', async () => {
    db.approval.updateMany.mockResolvedValue({ count: 1 });
    db.approval.findUnique.mockResolvedValue(renewalApproval);
    db.deadline.findUnique.mockResolvedValue({ id: 'd1', completedAt: new Date(), dueDate: new Date('2027-01-15') });
    const r = await applyApproval('a1', decider);
    expect(db.deadline.update).not.toHaveBeenCalled();
    expect(r.effect).toContain('No open renewal deadline');
  });
});

describe('applyApproval — registration_certificate', () => {
  it('sets the mark Registered on approval', async () => {
    db.approval.updateMany.mockResolvedValue({ count: 1 });
    db.approval.findUnique.mockResolvedValue({
      id: 'a2', companyId: 'c1', actionType: 'registration_certificate', trademarkId: 'tm2', inboundEmailId: 'e2',
      payloadJson: { kind: 'registration_certificate', fromStatus: 'Published', refs: ['UK123'] },
      trademark: { markText: 'ASOS', registryName: 'UKIPO' },
    });
    db.trademark.findUnique.mockResolvedValue({ id: 'tm2', status: 'Published', registryName: 'UKIPO', filingDate: null, registrationDate: new Date('2026-01-01') });
    db.trademark.update.mockResolvedValue({});
    db.deadline.findFirst.mockResolvedValue({ dueDate: new Date('2036-01-01') });
    const r = await applyApproval('a2', decider);
    expect(r.status).toBe('approved');
    expect(db.trademark.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'Registered' } }));
    expect(r.effect).toContain('Registered');
  });
});

describe('rejectApproval', () => {
  it('makes no mutation and returns the email to review', async () => {
    db.approval.updateMany.mockResolvedValue({ count: 1 });
    db.approval.findUnique.mockResolvedValue(renewalApproval);
    const r = await rejectApproval('a1', decider);
    expect(r.status).toBe('rejected');
    expect(db.deadline.update).not.toHaveBeenCalled();
    expect(db.trademark.update).not.toHaveBeenCalled();
    expect(db.inboundEmail.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'needs_review' } }));
  });
});

describe('autoActEnabled', () => {
  const saved = process.env.AUTO_ACT_REGISTRATION;
  afterEach(() => { process.env.AUTO_ACT_REGISTRATION = saved; });

  it('renewal_confirmation is never auto-act', () => {
    process.env.AUTO_ACT_REGISTRATION = 'true';
    expect(autoActEnabled('renewal_confirmation')).toBe(false);
  });
  it('registration_certificate defaults off, opts in via env', () => {
    delete process.env.AUTO_ACT_REGISTRATION;
    expect(autoActEnabled('registration_certificate')).toBe(false);
    process.env.AUTO_ACT_REGISTRATION = 'true';
    expect(autoActEnabled('registration_certificate')).toBe(true);
    process.env.AUTO_ACT_REGISTRATION = 'false';
    expect(autoActEnabled('registration_certificate')).toBe(false);
  });
});
