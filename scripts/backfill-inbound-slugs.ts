/**
 * Provision inbound forwarding slugs for companies that don't have one yet.
 * Defaults each company's inbound slug to its existing (already-unique) slug,
 * so its forwarding address is bree-{slug}@<domain>.
 *   npx tsx scripts/backfill-inbound-slugs.ts
 * Run against local now; against Azure only when Step 2 is deployed.
 */
import { prisma } from '../lib/db';

async function main() {
  const companies = await prisma.company.findMany({
    where: { inboundEmailSlug: null },
    select: { id: true, slug: true, name: true },
  });
  let set = 0;
  for (const c of companies) {
    // slug is already unique, so it's a safe default for the unique inbound slug.
    await prisma.company.update({ where: { id: c.id }, data: { inboundEmailSlug: c.slug } });
    console.log(`  ${c.name}: bree-${c.slug}@<domain>`);
    set++;
  }
  console.log(`Provisioned ${set} inbound slug(s); ${companies.length - set} skipped.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
