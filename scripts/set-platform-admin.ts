/**
 * Designate (or remove) a platform admin by email.
 *   npx tsx scripts/set-platform-admin.ts <email> [--remove]
 *
 * The user must have signed in at least once (so their User row exists via the
 * lazy Clerk sync). Platform admins get cross-tenant access for onboarding and
 * data correction.
 */
import { prisma } from '../lib/db';

async function main() {
  const email = process.argv[2] ?? process.env.PLATFORM_ADMIN_EMAIL;
  const remove = process.argv.includes('--remove');
  if (!email) throw new Error('usage: tsx scripts/set-platform-admin.ts <email> [--remove]');

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) throw new Error(`No user with email ${email} — they must sign in at least once first.`);

  if (remove) {
    await prisma.platformAdmin.deleteMany({ where: { userId: user.id } });
    console.log(`Removed platform admin: ${user.name} <${user.email}>`);
    return;
  }

  const pa = await prisma.platformAdmin.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  console.log(`Platform admin: ${user.name} <${user.email}> (record ${pa.id})`);
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
