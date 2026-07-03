import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { serializeAudit } from '../../../lib/serializers';
import { getCurrentCompany } from '../../../lib/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/audit — the active org's audit log, newest first (activity feed source).
export async function GET() {
  const company = await getCurrentCompany();
  if (!company) return NextResponse.json({ entries: [] });
  const entries = await prisma.auditLog.findMany({
    where: { companyId: company.id },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ entries: entries.map(serializeAudit) });
}
