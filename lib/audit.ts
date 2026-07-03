import type { Prisma } from '@prisma/client';
import { prisma } from './db';

type AuditInput = {
  companyId: string;
  userId: string | null;
  isPlatformAdmin: boolean;
  action: string; // e.g. 'trademark.create', 'trademark.update', 'note.delete'
  entityType: string; // 'Trademark' | 'Note'
  entityId: string;
  reason?: string | null;
  detail?: Prisma.InputJsonValue;
};

/**
 * Append an entry to the company's audit log. Platform-admin actions are
 * flagged (is_platform_admin) with a mandatory reason so the customer's
 * activity feed can surface them as "Updated by BrandVault Support".
 */
export function writeAudit(a: AuditInput) {
  return prisma.auditLog.create({
    data: {
      companyId: a.companyId,
      userId: a.userId,
      isPlatformAdmin: a.isPlatformAdmin,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      reason: a.reason ?? null,
      detailJson: a.detail,
    },
  });
}
