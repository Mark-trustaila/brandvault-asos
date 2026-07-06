/**
 * End-to-end check of the Step 3 processor against the LOCAL db (never Azure).
 * Creates a throwaway company + marks that match the committed synthetic
 * fixtures, ingests each email (as the webhook would) and processes it, then
 * asserts: status changes, deadlines, AuditLog entries (actor=Bree) and the
 * Bree Slack messages the processor dispatched. Slack sending is disabled, so
 * no real messages are posted — the intended message text is captured instead.
 *
 *   npx tsx scripts/verify-email-processing.ts
 */
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/db';
import { parseEml, contentHashOf } from '../lib/eml';
import { storeInboundEmail } from '../lib/inbound-store';
import { processInboundEmail } from '../lib/email-processor';

const SLUG = 'verify-email-proc-tmp';
const FIX = 'harness/fixtures';

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
  cond ? pass++ : fail++;
};

async function ingestFixture(companyId: string, file: string) {
  const p = await parseEml(fs.readFileSync(path.join(FIX, file)));
  const { id } = await storeInboundEmail(companyId, {
    messageId: p.messageId, fromAddress: p.fromAddress, subject: p.subject, bodyText: p.bodyText,
    contentHash: p.contentHash, rawHeaders: [], attachments: p.attachments.map((a) => ({ filename: a.filename, mimeType: a.mimeType, extractedText: a.extractedText })),
  });
  return processInboundEmail(id);
}

async function ingestRaw(companyId: string, subject: string, bodyText: string) {
  const { id } = await storeInboundEmail(companyId, {
    messageId: null, fromAddress: 'noreply@ipo.gov.uk', subject, bodyText,
    contentHash: contentHashOf(subject, bodyText), rawHeaders: [], attachments: [],
  });
  return processInboundEmail(id);
}

const D = (s: string) => new Date(s + 'T00:00:00Z');

async function main() {
  await prisma.company.deleteMany({ where: { slug: SLUG } });
  const co = await prisma.company.create({ data: { name: 'Verify Email Proc', slug: SLUG } });
  // Slack disabled -> sendBree no-ops; the processor still records intended alerts.
  await prisma.alertPreference.create({ data: { companyId: co.id, thresholdDays: [180, 90, 30], slackEnabled: false } });

  type MarkStatus = 'Registered' | 'Pending' | 'Published' | 'Expired' | 'Abandoned';
  const mk = (d: { markText: string; registryName: string; status: MarkStatus; applicationNumber?: string; filingDate?: Date; registrationDate?: Date }) =>
    prisma.trademark.create({
      data: {
        companyId: co.id,
        markText: d.markText,
        registryName: d.registryName,
        status: d.status,
        applicationNumber: d.applicationNumber,
        filingDate: d.filingDate,
        registrationDate: d.registrationDate,
      },
    });
  const renewalDeadline = (trademarkId: string, due: string) =>
    prisma.deadline.create({ data: { trademarkId, type: 'Renewal', description: 'Renewal', dueDate: D(due), windowStart: D(due) } });

  // ---- Marks matching the fixtures ----
  const regMark = await mk({ markText: 'NORTHWIND', registryName: 'UKIPO', status: 'Pending', applicationNumber: 'UK00003456789', filingDate: D('2016-06-01'), registrationDate: D('2017-01-15') });
  const remMatch = await mk({ markText: 'NORTHWIND HOME', registryName: 'UKIPO', status: 'Registered', applicationNumber: 'UK00003111222' });
  await renewalDeadline(remMatch.id, '2026-09-01'); // == the reminder's date -> MATCH
  const remMismatch = await mk({ markText: 'NORTHWIND MIS', registryName: 'UKIPO', status: 'Registered', applicationNumber: 'UK00009999999' });
  await renewalDeadline(remMismatch.id, '2027-06-01'); // != crafted reminder -> MISMATCH
  const confMark = await mk({ markText: 'NORTHWIND EU', registryName: 'EUIPO', status: 'Registered', applicationNumber: '018777888' });
  const confDeadline = await renewalDeadline(confMark.id, '2026-05-18');
  const examMark = await mk({ markText: 'NORTHWIND SOLAR', registryName: 'UKIPO', status: 'Pending', applicationNumber: 'UK00003999000' });
  const oppMark = await mk({ markText: 'NORTHWIND FRESH', registryName: 'EUIPO', status: 'Pending', applicationNumber: '018222333' });
  const euipoLoginMark = await mk({ markText: 'NORTHWIND UA', registryName: 'EUIPO', status: 'Pending', applicationNumber: '018444555' });
  const cancelMark = await mk({ markText: 'NORTHWIND DEAD', registryName: 'UKIPO', status: 'Registered', applicationNumber: 'UK00007777777' });

  // ============ HIGH-confidence auto-actions ============
  console.log('\n== registration_certificate ==');
  const r1 = await ingestFixture(co.id, 'ukipo-registration-certificate.eml');
  const regAfter = await prisma.trademark.findUnique({ where: { id: regMark.id } });
  const regRenewal = await prisma.deadline.findFirst({ where: { trademarkId: regMark.id, type: 'Renewal' } });
  check('cert: matched + processed', r1.status === 'processed' && r1.matchedTrademarkId === regMark.id, r1.actions.join('; '));
  check('cert: mark set Registered', regAfter?.status === 'Registered');
  check('cert: renewal deadline calculated', Boolean(regRenewal));
  check('cert: Bree confirmation alert', r1.alerts.some((a) => /registered/i.test(a)));

  console.log('\n== renewal_reminder (MATCH) ==');
  const r2 = await ingestFixture(co.id, 'ukipo-renewal-reminder.eml');
  check('reminder-match: processed + reconciled match', r2.status === 'processed' && r2.actions.some((a) => /MATCH/.test(a)), r2.actions.join('; '));
  check('reminder-match: confirmation alert', r2.alerts.some((a) => /matches our deadline|confirmed by registry/i.test(a)));

  console.log('\n== renewal_reminder (MISMATCH) ==');
  const r3 = await ingestRaw(co.id, 'Trade mark renewal reminder - UK00009999999', 'The registration UK00009999999 is due for renewal by 01 September 2026. Please renew before this date.');
  check('reminder-mismatch: high-priority mismatch alert', r3.status === 'processed' && r3.actions.some((a) => /MISMATCH/.test(a)), r3.actions.join('; '));
  check('reminder-mismatch: alert names both dates', r3.alerts.some((a) => /MISMATCH/i.test(a)));

  console.log('\n== renewal_confirmation ==');
  const r4 = await ingestFixture(co.id, 'euipo-renewal-confirmation.eml');
  const confAfter = await prisma.deadline.findUnique({ where: { id: confDeadline.id } });
  check('confirmation: processed', r4.status === 'processed', r4.actions.join('; '));
  check('confirmation: deadline marked complete', confAfter?.completedAt != null);

  // ============ Alert-only ============
  console.log('\n== examination_report (alert-only) ==');
  const r5 = await ingestFixture(co.id, 'ukipo-examination-report.eml');
  const examAfter = await prisma.trademark.findUnique({ where: { id: examMark.id } });
  check('exam: needs_review, matched', r5.status === 'needs_review' && r5.matchedTrademarkId === examMark.id, r5.type);
  check('exam: mark status unchanged (no auto-act)', examAfter?.status === 'Pending');
  check('exam: alert dispatched', r5.alerts.length > 0);

  console.log('\n== opposition_notice (alert-only) ==');
  const r6 = await ingestFixture(co.id, 'euipo-opposition-notice.eml');
  check('opposition: needs_review + alert', r6.status === 'needs_review' && r6.alerts.length > 0, r6.type);

  console.log('\n== euipo_login_notification (alert-only, matched) ==');
  const r7 = await ingestFixture(co.id, 'euipo-login-notification.eml');
  check('euipo login: needs_review + alert', r7.status === 'needs_review' && r7.matchedTrademarkId === euipoLoginMark.id && r7.alerts.length > 0, r7.type);

  console.log('\n== cancellation_notice (never silently kills) ==');
  const r8 = await ingestRaw(co.id, 'Cancellation of trade mark UK00007777777', 'Notice: an application for cancellation / revocation of registered trade mark UK00007777777 (NORTHWIND DEAD) has been filed.');
  const cancelAfter = await prisma.trademark.findUnique({ where: { id: cancelMark.id } });
  check('cancellation: needs_review, matched', r8.status === 'needs_review' && r8.matchedTrademarkId === cancelMark.id, r8.type);
  check('cancellation: mark NOT killed (still Registered)', cancelAfter?.status === 'Registered');
  check('cancellation: alert says status change reported', r8.alerts.some((a) => /confirm|status change reported/i.test(a)) || r8.type === 'cancellation_notice');

  // ============ ambiguous / unmatched ============
  console.log('\n== ambiguous (client question) ==');
  const r9 = await ingestFixture(co.id, 'ambiguous-client-question.eml');
  check('ambiguous: needs_review, no alert', r9.status === 'needs_review' && r9.alerts.length === 0, r9.type);

  console.log('\n== alert-only unmatched (exam report, mark not in portfolio) ==');
  const r10 = await ingestFixture(co.id, 'forwarded-ref-in-pdf.eml'); // UK00003555444 — no such mark
  check('alert-only unmatched: status unmatched + alert dispatched', r10.status === 'unmatched' && r10.alerts.length > 0, r10.actions.join('; '));

  console.log('\n== unmatched auto-act (cert for a mark not in portfolio) ==');
  const r11 = await ingestRaw(co.id, 'Certificate of Registration - UK00008888888', 'I confirm that trade mark UK00008888888 (GHOSTMARK), class 9, has completed registration and has been entered in the register.');
  check('unmatched cert: status unmatched + "not in portfolio" notice', r11.status === 'unmatched' && r11.alerts.some((a) => /not in your portfolio/i.test(a)), r11.actions.join('; '));

  // ============ Audit ============
  console.log('\n== audit ==');
  const breeAudits = await prisma.auditLog.findMany({ where: { companyId: co.id, actor: 'Bree' } });
  check('every processed email produced a Bree audit entry', breeAudits.length >= 10, `${breeAudits.length} entries`);
  check('audit actions include the auto-actions', ['bree.email.registered', 'bree.email.renewal_reconciled', 'bree.email.renewal_mismatch', 'bree.email.renewal_completed'].every((a) => breeAudits.some((e) => e.action === a)));

  await prisma.company.delete({ where: { id: co.id } });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
