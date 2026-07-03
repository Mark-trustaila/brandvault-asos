import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

// Hits MySQL at request time — never statically evaluated at build.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const iso = (d: Date | null): string | undefined => d?.toISOString();

// Serves the trademark portfolio from the database in the shape the dashboard
// already expects (see types/trademark.ts). Replaces the old static-JSON read.
// No tenant filtering yet — added with Clerk auth in Phase 1 step 3.
export async function GET() {
  const marks = await prisma.trademark.findMany({
    include: { goodsServices: true },
    orderBy: { markText: 'asc' },
  });

  const trademarks = marks.map((m) => ({
    id: m.id,
    registry_name: m.registryName,
    mark_text: m.markText,
    application_number: m.applicationNumber ?? '',
    registration_number: m.registrationNumber ?? undefined,
    status: m.status,
    filing_date: iso(m.filingDate),
    registration_date: iso(m.registrationDate),
    expiry_date: iso(m.expiryDate),
    publication_date: iso(m.publicationDate),
    client_agent_name: m.clientAgentName ?? undefined,
    good_and_services: m.goodsServices.map((g) => ({
      search_class: { number: g.classNumber },
      text: g.text,
    })),
    publication_notes: '',
  }));

  return NextResponse.json({
    count: trademarks.length,
    trademarks,
    fetchedAt: new Date().toISOString(),
    source: 'database',
  });
}
