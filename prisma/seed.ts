/**
 * Seed the demo ASOS portfolio from the static snapshot into MySQL.
 *
 * Reads public/asos-trademark-data.json (the 81-mark demo bundle that used to
 * be served directly) and loads it as a single customer company. Idempotent:
 * the ASOS company is deleted first (cascading to its marks/goods) and rebuilt,
 * so re-running produces the same state.
 *
 * Run with: npm run db:seed   (or: npx prisma db seed)
 */
import { readFileSync } from 'fs';
import path from 'path';
import { PrismaClient, MarkStatus } from '@prisma/client';

const prisma = new PrismaClient();

const COMPANY_SLUG = 'asos-plc';

type RawGoods = { search_class?: { number?: number }; text?: string };
type RawMark = {
  id: string;
  registry_name: string;
  mark_text: string;
  status: string;
  application_number?: string | null;
  registration_number?: string | null;
  application_date?: string | null;
  registration_date?: string | null;
  expiry_date?: string | null;
  publication_date?: string | null;
  client_agent_name?: string | null;
  good_and_services?: RawGoods[];
};

const toDate = (v?: string | null): Date | null => (v ? new Date(v) : null);

async function main() {
  const file = path.join(process.cwd(), 'public', 'asos-trademark-data.json');
  const raw = JSON.parse(readFileSync(file, 'utf-8')) as { trademarks: RawMark[] };
  const marks = raw.trademarks ?? [];

  // Idempotent reseed: remove the demo company (cascades to marks + goods).
  await prisma.company.deleteMany({ where: { slug: COMPANY_SLUG } });

  const company = await prisma.company.create({
    data: {
      name: 'ASOS plc',
      slug: COMPANY_SLUG,
      // Placeholder until Clerk is wired (Phase 1 step 3).
      clerkOrgId: 'seed-org-asos-plc',
    },
  });

  // Demo user so notes have an author until Clerk provides real users.
  const user = await prisma.user.create({
    data: {
      email: 'mark@lawpanel.com',
      name: 'Mark Kingsley-Williams',
      role: 'admin',
      companyId: company.id,
      clerkUserId: 'seed-user-mark',
    },
  });

  let markCount = 0;
  let goodsCount = 0;

  for (const m of marks) {
    const goods = (m.good_and_services ?? [])
      .filter((g) => typeof g.search_class?.number === 'number')
      .map((g) => ({ classNumber: g.search_class!.number as number, text: g.text ?? '' }));

    await prisma.trademark.create({
      data: {
        id: m.id, // preserve the original id (frontend keys notes etc. by it)
        companyId: company.id,
        registryName: m.registry_name,
        markText: m.mark_text,
        status: m.status as MarkStatus,
        applicationNumber: m.application_number ?? null,
        registrationNumber: m.registration_number ?? null,
        filingDate: toDate(m.application_date), // application date == filing date
        registrationDate: toDate(m.registration_date),
        expiryDate: toDate(m.expiry_date),
        publicationDate: toDate(m.publication_date),
        clientAgentName: m.client_agent_name ?? null,
        goodsServices: { create: goods },
      },
    });
    markCount += 1;
    goodsCount += goods.length;
  }

  console.log(`Seeded company "${company.name}" (${company.slug})`);
  console.log(`  user:       ${user.name} <${user.email}>`);
  console.log(`  trademarks: ${markCount}`);
  console.log(`  goods rows: ${goodsCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
