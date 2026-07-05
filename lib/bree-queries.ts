/**
 * Read queries backing Bree's slash commands. Return the plain shapes the
 * formatters in bree-messages.ts expect.
 */
import { prisma } from './db';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysFrom = (d: Date, now: Date) => Math.floor((d.getTime() - now.getTime()) / 86_400_000);

export async function portfolioSummary(companyId: string, now = new Date()) {
  const in12mo = new Date(now.getTime());
  in12mo.setUTCFullYear(in12mo.getUTCFullYear() + 1);
  const [total, registered, pending, published, needsAttention] = await Promise.all([
    prisma.trademark.count({ where: { companyId } }),
    prisma.trademark.count({ where: { companyId, status: 'Registered' } }),
    prisma.trademark.count({ where: { companyId, status: 'Pending' } }),
    prisma.trademark.count({ where: { companyId, status: 'Published' } }),
    prisma.trademark.count({ where: { companyId, deadlines: { some: { dueDate: { gte: now, lte: in12mo } } } } }),
  ]);
  return { total, registered, pending, published, needsAttention };
}

export async function upcomingRenewals(companyId: string, limit = 5, now = new Date()) {
  const rows = await prisma.deadline.findMany({
    where: { trademark: { companyId }, dueDate: { gte: now } },
    include: { trademark: true },
    orderBy: { dueDate: 'asc' },
    take: limit,
  });
  return rows.map((d) => ({
    markText: d.trademark.markText,
    registry: d.trademark.registryName,
    dueDate: isoDay(d.dueDate),
    daysRemaining: daysFrom(d.dueDate, now),
  }));
}

export async function markStatus(companyId: string, query: string, now = new Date()) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  // Case-insensitive match, independent of the MySQL column collation (Prisma
  // has no `mode: 'insensitive'` on MySQL). Portfolios are small (tens–low
  // hundreds), so filtering in code is cheap and correct. Prefer an exact
  // (case-insensitive) match, then fall back to a substring match.
  const marks = await prisma.trademark.findMany({ where: { companyId }, orderBy: { markText: 'asc' } });
  const mark =
    marks.find((m) => m.markText.toLowerCase() === q) ?? marks.find((m) => m.markText.toLowerCase().includes(q));
  if (!mark) return null;
  const next = await prisma.deadline.findFirst({
    where: { trademarkId: mark.id, dueDate: { gte: now } },
    orderBy: { dueDate: 'asc' },
  });
  return {
    markText: mark.markText,
    registry: mark.registryName,
    status: mark.status as string,
    nextDeadline: next
      ? { type: next.type, dueDate: isoDay(next.dueDate), daysRemaining: daysFrom(next.dueDate, now) }
      : undefined,
  };
}
