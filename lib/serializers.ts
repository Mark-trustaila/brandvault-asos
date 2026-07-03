import type { GoodsService, Note, Trademark, User } from '@prisma/client';
import { getInitials } from './utils';

const iso = (d: Date | null): string | undefined => d?.toISOString();

/**
 * Map a DB trademark (+ its goods) to the shape the dashboard expects
 * (see types/trademark.ts). Keeps the API contract identical to the old
 * static-JSON payload.
 */
export function serializeTrademark(m: Trademark & { goodsServices: GoodsService[] }) {
  return {
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
  };
}

/**
 * Map a DB note (+ its author) to the frontend Note shape. `text` carries the
 * sanitised HTML the composer produces (legacy from the localStorage version,
 * rendered via dangerouslySetInnerHTML).
 */
export function serializeNote(n: Note & { user: User | null }) {
  return {
    id: n.id,
    text: n.text,
    html: n.html ?? undefined,
    link: n.link ?? undefined,
    author: getInitials(n.user?.name ?? ''),
    authorFull: n.user?.name ?? 'Unknown',
    date: n.createdAt.toISOString(),
  };
}
