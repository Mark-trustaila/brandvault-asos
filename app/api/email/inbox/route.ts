import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getActingCompany } from '../../../../lib/authz';
import type { InboundEmailStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALL_STATUSES: InboundEmailStatus[] = ['pending', 'processed', 'needs_review', 'unmatched', 'dismissed'];

// GET /api/email/inbox?status=needs_review,unmatched — the review queues for the
// acting company (platform admins act cross-tenant via the x-bv-company-id
// header). Defaults to the two queues that need a human: needs_review + unmatched.
export async function GET(req: Request) {
  const company = await getActingCompany(req);
  if (!company) return NextResponse.json({ error: 'No active organization' }, { status: 403 });

  const param = new URL(req.url).searchParams.get('status');
  const statuses = (param ? param.split(',') : ['needs_review', 'unmatched']).filter((s): s is InboundEmailStatus =>
    ALL_STATUSES.includes(s as InboundEmailStatus)
  );

  const rows = await prisma.inboundEmail.findMany({
    where: { companyId: company.id, status: { in: statuses.length ? statuses : ['needs_review', 'unmatched'] } },
    orderBy: { receivedAt: 'desc' },
    include: {
      matchedTrademark: { select: { id: true, markText: true, registryName: true, status: true } },
      attachments: { select: { filename: true, mimeType: true } },
    },
    take: 200,
  });

  // Counts per queue for the tab badges.
  const grouped = await prisma.inboundEmail.groupBy({ by: ['status'], where: { companyId: company.id }, _count: true });
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count]));

  return NextResponse.json({
    company: { id: company.id, name: company.name },
    counts,
    emails: rows.map((e) => ({
      id: e.id,
      receivedAt: e.receivedAt.toISOString(),
      fromAddress: e.fromAddress,
      subject: e.subject,
      status: e.status,
      classification: e.classificationJson ?? null,
      reviewClassification: e.reviewClassificationJson ?? null,
      matchedTrademark: e.matchedTrademark,
      attachments: e.attachments,
      reviewedAt: e.reviewedAt?.toISOString() ?? null,
    })),
  });
}
