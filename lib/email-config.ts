import type { CommunicationType } from './email-types';

/**
 * Whether a HIGH-confidence inbound communication may mutate mark data
 * automatically, versus proposing the change for human approval.
 *
 * Policy (supersedes the original Phase-4 "HIGH-confidence auto-actions" design):
 *
 *   - `renewal_confirmation` — NEVER auto. Completing a renewal deadline is a
 *     permanent change that silences future alerts on a live obligation; a
 *     wrongly-completed renewal is the worst failure this product can produce.
 *     It always goes through propose-and-approve.
 *
 *   - `registration_certificate` — gated behind `AUTO_ACT_REGISTRATION=true`.
 *     Defaults to propose-and-approve so the classifier can build a live
 *     track record; can be promoted back to auto-act once HIGH-confidence
 *     precision on real mail is measured (see BreeQueryLog / classification logs).
 *
 *   - everything else — not an auto-act type (alert-only / reconcile-only).
 */
export function autoActEnabled(type: CommunicationType): boolean {
  if (type === 'renewal_confirmation') return false;
  if (type === 'registration_certificate') {
    return (process.env.AUTO_ACT_REGISTRATION ?? '').trim().toLowerCase() === 'true';
  }
  return false;
}
