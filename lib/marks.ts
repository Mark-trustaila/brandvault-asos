import type { Prisma } from '@prisma/client';

export const MARK_STATUSES = ['Registered', 'Pending', 'Published', 'Expired', 'Abandoned'] as const;

/**
 * Parse a goods & services array from a request body. Accepts either
 * { classNumber, text } or the frontend shape { search_class: { number }, text }.
 * Returns undefined if the field is absent (leave goods untouched), or a
 * (possibly empty) array to replace them with.
 */
export function parseGoods(raw: unknown): { classNumber: number; text: string }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((g) => {
      const gg = g as { classNumber?: unknown; search_class?: { number?: unknown }; text?: unknown };
      const cls = typeof gg.classNumber === 'number' ? gg.classNumber : gg.search_class?.number;
      if (typeof cls !== 'number') return null;
      return { classNumber: cls, text: String(gg.text ?? '') };
    })
    .filter((g): g is { classNumber: number; text: string } => g !== null);
}

const STRING_FIELDS = ['applicationNumber', 'registrationNumber', 'clientAgentName', 'familyId', 'ownerName', 'ownerCountry', 'representativeName', 'representativeReference'] as const;
const DATE_FIELDS = ['filingDate', 'registrationDate', 'expiryDate', 'publicationDate'] as const;

type Body = Record<string, unknown>;
type Result = { data: Prisma.TrademarkUncheckedUpdateInput; error?: undefined } | { data?: undefined; error: string };

const asDate = (v: unknown): Date | null | undefined => {
  if (v === null) return null;
  if (typeof v === 'string' && v) return new Date(v);
  return undefined; // omit
};

/**
 * Validate and normalise a trademark request body into Prisma field data.
 *
 * partial=false (create): markText, registryName, status are required — the
 * minimum-required set from the data model. partial=true (PATCH): only the
 * fields present are validated; everything else is left untouched. Optional
 * fields accept null to clear them, honouring "incomplete records are
 * first-class".
 */
export function buildMarkData(raw: unknown, { partial }: { partial: boolean }): Result {
  if (!raw || typeof raw !== 'object') return { error: 'Invalid JSON body' };
  const body = raw as Body;
  const data: Prisma.TrademarkUncheckedUpdateInput = {};

  if (body.markText !== undefined) data.markText = String(body.markText);
  else if (!partial) return { error: 'markText is required' };

  if (body.registryName !== undefined) data.registryName = String(body.registryName);
  else if (!partial) return { error: 'registryName is required' };

  if (body.status !== undefined) {
    if (!MARK_STATUSES.includes(body.status as (typeof MARK_STATUSES)[number])) {
      return { error: `status must be one of: ${MARK_STATUSES.join(', ')}` };
    }
    data.status = body.status as (typeof MARK_STATUSES)[number];
  } else if (!partial) {
    return { error: 'status is required' };
  }

  for (const f of STRING_FIELDS) {
    if (body[f] !== undefined) data[f] = body[f] === null ? null : String(body[f]);
  }
  for (const f of DATE_FIELDS) {
    const d = asDate(body[f]);
    if (d !== undefined) data[f] = d;
  }

  return { data };
}
