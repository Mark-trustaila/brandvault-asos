import type { Trademark } from '../types/trademark';

/**
 * Per-mark completeness: which optional fields are filled. Required fields
 * (mark, registry, status) are always present, so they're not scored. Used for
 * gentle "fill the gaps" prompts — never a blocking error.
 */
const FIELDS: { label: string; filled: (t: Trademark) => boolean }[] = [
  { label: 'Application no.', filled: (t) => !!t.application_number },
  { label: 'Registration no.', filled: (t) => !!t.registration_number },
  { label: 'Filing date', filled: (t) => !!t.filing_date },
  { label: 'Registration date', filled: (t) => !!t.registration_date },
  { label: 'Expiry date', filled: (t) => !!t.expiry_date },
  { label: 'Client / agent', filled: (t) => !!t.client_agent_name },
  { label: 'Goods & services', filled: (t) => (t.good_and_services?.length ?? 0) > 0 },
  { label: 'Family', filled: (t) => !!t.family_id },
];

export function computeCompleteness(t: Trademark): {
  filled: number;
  total: number;
  pct: number;
  missing: string[];
} {
  const missing = FIELDS.filter((f) => !f.filled(t)).map((f) => f.label);
  const filled = FIELDS.length - missing.length;
  return { filled, total: FIELDS.length, pct: Math.round((filled / FIELDS.length) * 100), missing };
}
