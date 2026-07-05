/**
 * Throwaway verification for edit-mode backend (goods replace, families, assign).
 *   npx tsx scripts/verify-editing.ts
 */
import { prisma } from '../lib/db';
import { parseGoods } from '../lib/marks';

async function main() {
  // parseGoods accepts both shapes and drops invalid rows
  const g = parseGoods([
    { classNumber: 25, text: 'Clothing' },
    { search_class: { number: 9 }, text: 'Software' },
    { text: 'no class' },
  ]);
  console.log(`parseGoods -> ${g?.length} rows (expect 2):`, JSON.stringify(g));

  const company = await prisma.company.create({
    data: { name: 'Edit Co', slug: `edit-co-${Date.now().toString(36)}`, clerkOrgId: null },
  });

  // create a mark with goods
  const mark = await prisma.trademark.create({
    data: {
      companyId: company.id, registryName: 'UKIPO', markText: 'EDITME', status: 'Pending',
      goodsServices: { create: [{ classNumber: 25, text: 'Clothing' }] },
    },
    include: { goodsServices: true },
  });
  console.log(`created mark with goods: ${mark.goodsServices.length} (expect 1)`);

  // replace-all goods on update (deleteMany + create)
  const updated = await prisma.trademark.update({
    where: { id: mark.id },
    data: { status: 'Registered', goodsServices: { deleteMany: {}, create: [{ classNumber: 9, text: 'Software' }, { classNumber: 42, text: 'IT' }] } },
    include: { goodsServices: true },
  });
  console.log(`after replace: status=${updated.status}, goods=${updated.goodsServices.length} (expect Registered, 2)`);

  // create a family and assign the mark
  const family = await prisma.trademarkFamily.create({ data: { companyId: company.id, familyName: 'EDITME family' } });
  const assigned = await prisma.trademark.update({ where: { id: mark.id }, data: { familyId: family.id } });
  console.log(`assigned to family: ${assigned.familyId === family.id ? 'OK' : 'FAIL'}`);

  // delete the mark (cascades goods)
  await prisma.trademark.delete({ where: { id: mark.id } });
  const remaining = await prisma.trademark.count({ where: { companyId: company.id } });
  console.log(`after delete: marks=${remaining} (expect 0)`);

  await prisma.company.delete({ where: { id: company.id } });
  console.log('cleaned up');
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
