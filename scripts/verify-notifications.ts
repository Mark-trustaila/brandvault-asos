/**
 * Verifies the notifications data layer that the (Clerk-gated) API routes wrap:
 * creation + deep link, per-user read state / unread counts, and cross-tenant
 * scoping. Runs against the LOCAL db with throwaway data. The routes themselves
 * (GET/POST /api/notifications*, /api/bree) are Clerk-gated → browser-tested.
 *
 *   npx tsx scripts/verify-notifications.ts
 */
import { prisma } from '../lib/db';
import { createNotification } from '../lib/notifications';

const SLUG = 'verify-notif-tmp';
const SLUG2 = 'verify-notif-tmp-2';
let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
  cond ? pass++ : fail++;
};

// Mirror GET /api/notifications for a user (per-user read + unread count).
async function listFor(userId: string, companyId: string) {
  const rows = await prisma.notification.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: { reads: { where: { userId } } },
  });
  const unread = await prisma.notification.count({ where: { companyId, reads: { none: { userId } } } });
  return { rows, unread };
}

async function main() {
  await prisma.company.deleteMany({ where: { slug: { in: [SLUG, SLUG2] } } });
  const co = await prisma.company.create({ data: { name: 'Verify Notif', slug: SLUG } });
  const co2 = await prisma.company.create({ data: { name: 'Verify Notif 2', slug: SLUG2 } });
  const mkUser = (companyId: string, n: number) =>
    prisma.user.create({ data: { email: `u${n}-${SLUG}@x.com`, clerkUserId: `clerk-${n}-${SLUG}`, companyId, role: 'admin', name: `U${n}` } });
  const user1 = await mkUser(co.id, 1);
  const user2 = await mkUser(co.id, 2);
  const mark = await prisma.trademark.create({ data: { companyId: co.id, registryName: 'UKIPO', markText: 'NOTIFCO', status: 'Registered' } });

  const n1 = await createNotification({ companyId: co.id, trademarkId: mark.id, type: 'renewal_alert', title: 'Renewal approaching', body: 'renewal soon' });
  await createNotification({ companyId: co.id, type: 'digest', title: 'Weekly digest', body: '2 upcoming' });
  const nOther = await createNotification({ companyId: co2.id, type: 'digest', title: 'Weekly digest', body: 'other' });

  check('deep-link format /?notification=<id>', n1.link.endsWith(`/?notification=${n1.id}`), n1.link);

  let l1 = await listFor(user1.id, co.id);
  check('user1 sees exactly the 2 company notifications', l1.rows.length === 2);
  check('user1 unread = 2 (nothing read yet)', l1.unread === 2, `got ${l1.unread}`);

  // Mark n1 read for user1 (as POST /api/notifications/:id/read does).
  await prisma.notificationRead.upsert({
    where: { notificationId_userId: { notificationId: n1.id, userId: user1.id } },
    create: { notificationId: n1.id, userId: user1.id },
    update: {},
  });
  l1 = await listFor(user1.id, co.id);
  check('user1 unread = 1 after reading one', l1.unread === 1, `got ${l1.unread}`);
  check('n1 shows read for user1', (l1.rows.find((r) => r.id === n1.id)?.reads.length ?? 0) === 1);
  const l2 = await listFor(user2.id, co.id);
  check('user2 unread still 2 (read state is per-user)', l2.unread === 2, `got ${l2.unread}`);

  // Idempotent read.
  await prisma.notificationRead.upsert({
    where: { notificationId_userId: { notificationId: n1.id, userId: user1.id } },
    create: { notificationId: n1.id, userId: user1.id },
    update: {},
  });
  check('marking read twice stays unread=1 (idempotent)', (await listFor(user1.id, co.id)).unread === 1);

  // Company scoping (as GET /api/notifications/:id with companyId filter).
  check('own-company notification is fetchable', Boolean(await prisma.notification.findFirst({ where: { id: n1.id, companyId: co.id } })));
  check("another company's notification → null (404 scoping)", (await prisma.notification.findFirst({ where: { id: nOther.id, companyId: co.id } })) === null);

  await prisma.company.deleteMany({ where: { slug: { in: [SLUG, SLUG2] } } });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
