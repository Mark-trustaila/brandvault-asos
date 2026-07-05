import type { Trademark as PrismaTrademark } from '@prisma/client';
import type { Trademark } from '../types/trademark';
import { prisma } from './db';
import { getObligationsForTrademark } from './utils';

type MarkForRecalc = Pick<PrismaTrademark, 'id' | 'registryName' | 'filingDate' | 'registrationDate'>;

/**
 * Recalculate a mark's deadlines with the config-driven renewal engine and
 * persist them to the Deadlines table (replace-all). Sets the mark's needsData
 * flag when a required date is missing (the engine returns an uncertain
 * obligation, which can't be persisted as a dated deadline).
 */
export async function recalcDeadlines(mark: MarkForRecalc): Promise<{ persisted: number; needsData: boolean }> {
  const shaped = {
    registry_name: mark.registryName,
    filing_date: mark.filingDate ? mark.filingDate.toISOString() : undefined,
    registration_date: mark.registrationDate ? mark.registrationDate.toISOString() : undefined,
  } as Trademark;

  const obligations = getObligationsForTrademark(shaped);
  const concrete = obligations.filter((o) => !o.uncertain && o.dueDate);
  const needsData = obligations.some((o) => o.uncertain);

  await prisma.$transaction([
    prisma.deadline.deleteMany({ where: { trademarkId: mark.id } }),
    ...(concrete.length
      ? [
          prisma.deadline.createMany({
            data: concrete.map((o) => ({
              trademarkId: mark.id,
              type: o.type,
              description: o.desc,
              dueDate: o.dueDate as Date,
              windowStart: (o.windowStart ?? o.dueDate) as Date,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
    prisma.trademark.update({ where: { id: mark.id }, data: { needsData } }),
  ]);

  return { persisted: concrete.length, needsData };
}
