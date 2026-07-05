/**
 * Daily alert engine — pure selection logic + the orchestration the cron job runs.
 * Slack (Bree) is the only live channel for now; email is checked and skipped
 * gracefully until SMTP is wired.
 */
import { prisma } from './db';
import { postToSlack } from './slack';
import * as bree from './bree-messages';

export const DEFAULT_THRESHOLDS = [180, 90, 30];

// The three dedup flags on Deadline, mapped by threshold index (largest first).
// Supports up to 3 configured thresholds; the default [180,90,30] maps exactly.
const FLAG_FIELDS = ['alert180Sent', 'alert90Sent', 'alert30Sent'] as const;

export function daysUntil(due: Date, now: Date): number {
  return Math.floor((due.getTime() - now.getTime()) / 86_400_000);
}

/**
 * Which threshold a deadline currently falls in — the index (into thresholds
 * sorted descending) of the *tightest* threshold it has crossed, or -1 if it's
 * still further out than every threshold. Pure.
 *   thresholds [180,90,30]: 170d -> 0 (180), 88d -> 1 (90), 28d -> 2 (30), 210d -> -1
 */
export function alertBucket(days: number, thresholdsDesc: number[]): number {
  let bucket = -1;
  for (let i = 0; i < thresholdsDesc.length; i++) {
    if (days <= thresholdsDesc[i]) bucket = i;
  }
  return bucket;
}

function normalizeThresholds(raw: unknown): number[] {
  const arr = Array.isArray(raw) ? raw.filter((n) => typeof n === 'number' && n > 0) : [];
  return (arr.length ? (arr as number[]) : DEFAULT_THRESHOLDS).slice().sort((a, b) => b - a);
}

// Email is not wired yet; treat SMTP as unconfigured so the job skips it cleanly.
export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Notify Slack (Bree) that a mark's status changed. Best-effort — never throws,
 * so a Slack outage can't block the mark update. No-op when status is unchanged
 * or the company hasn't connected/enabled Slack with a channel.
 */
export async function notifyStatusChange(
  companyId: string,
  mark: { markText: string; registryName: string },
  from: string,
  to: string
): Promise<void> {
  if (from === to) return;
  try {
    const p = await prisma.alertPreference.findUnique({ where: { companyId } });
    if (!p?.slackEnabled || !p.slackBotToken || !p.slackChannelId) return;
    await postToSlack(p.slackBotToken, p.slackChannelId, bree.statusChange({ markText: mark.markText, registry: mark.registryName, from, to }));
  } catch {
    /* best-effort */
  }
}

type Summary = { companies: number; alertsSent: number; digests: number; emailSkipped: number };

/**
 * Run the daily sweep. For each Slack-enabled company with a channel:
 *  - send a renewal alert for each deadline that has crossed an unsent threshold,
 *    marking that threshold (and any larger ones) sent so we never backfill;
 *  - on Mondays (UTC), send a weekly digest of the next deadlines.
 * Email is counted and skipped while SMTP is unconfigured.
 */
export async function runDailyAlerts(now = new Date()): Promise<Summary> {
  const prefs = await prisma.alertPreference.findMany({
    where: { slackEnabled: true, slackBotToken: { not: null }, slackChannelId: { not: null } },
  });

  const out: Summary = { companies: prefs.length, alertsSent: 0, digests: 0, emailSkipped: 0 };
  const isMonday = now.getUTCDay() === 1;

  for (const p of prefs) {
    const token = p.slackBotToken!;
    const channel = p.slackChannelId!;
    const thresholds = normalizeThresholds(p.thresholdDays);

    const deadlines = await prisma.deadline.findMany({
      where: { trademark: { companyId: p.companyId }, dueDate: { gte: now } },
      include: { trademark: true },
      orderBy: { dueDate: 'asc' },
    });

    for (const d of deadlines) {
      const days = daysUntil(d.dueDate, now);
      const bucket = alertBucket(days, thresholds);
      if (bucket < 0) continue;
      const flag = FLAG_FIELDS[Math.min(bucket, FLAG_FIELDS.length - 1)];
      if ((d as Record<string, unknown>)[flag]) continue; // already alerted at this threshold

      const msg = bree.renewalAlert({
        markText: d.trademark.markText,
        registry: d.trademark.registryName,
        type: d.type,
        dueDate: d.dueDate.toISOString().slice(0, 10),
        daysRemaining: days,
      });
      const res = await postToSlack(token, channel, msg);
      if (res.ok) {
        const data: Record<string, boolean> = {};
        for (let i = 0; i <= bucket && i < FLAG_FIELDS.length; i++) data[FLAG_FIELDS[i]] = true;
        await prisma.deadline.update({ where: { id: d.id }, data });
        out.alertsSent++;
      }
    }

    if (isMonday) {
      const upcoming = deadlines.slice(0, 10).map((u) => ({
        markText: u.trademark.markText,
        registry: u.trademark.registryName,
        type: u.type,
        dueDate: u.dueDate.toISOString().slice(0, 10),
        daysRemaining: daysUntil(u.dueDate, now),
      }));
      const company = await prisma.company.findUnique({ where: { id: p.companyId } });
      const res = await postToSlack(token, channel, bree.weeklyDigest({ companyName: company?.name ?? 'your portfolio', upcoming }));
      if (res.ok) out.digests++;
    }

    // Email channel — deliberately skipped until SMTP is configured.
    if (p.emailEnabled && !smtpConfigured()) out.emailSkipped++;
  }

  return out;
}
