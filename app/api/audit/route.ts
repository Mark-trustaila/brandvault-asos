import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { serializeAudit } from '../../../lib/serializers';
import { getActingCompany } from '../../../lib/authz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/audit — the acting company's audit log, newest first (activity feed).
export async function GET(req: Request) {
  const company = await getActingCompany(req);
  if (!company) return NextResponse.json({ entries: [] });
  const entries = await prisma.auditLog.findMany({
    where: { companyId: company.id },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ entries: entries.map(serializeAudit) });
}
