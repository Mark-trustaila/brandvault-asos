/**
 * Shared types for Phase 4 inbound email classification (Bree).
 * Step 1 is classification only — no DB, no infra.
 */

export const REGISTRIES = ['UKIPO', 'EUIPO', 'WIPO', 'other', 'unknown'] as const;
export type Registry = (typeof REGISTRIES)[number];

/**
 * v1 communication taxonomy. HIGH-confidence auto-actable types:
 *   registration_certificate — mark registered → set Registered + renewal deadline
 *   renewal_reminder         — registry says a renewal is DUE → reconcile vs our engine
 *   renewal_confirmation     — registry CONFIRMS a renewal was processed → clear the
 *                              matching deadline (distinct from a reminder)
 * Classify + alert, no auto-act:
 *   examination_report, opposition_notice, cancellation_notice, euipo_login_notification
 * Everything else → ambiguous / other (MEDIUM/LOW queue).
 */
export const COMMUNICATION_TYPES = [
  'registration_certificate',
  'renewal_reminder',
  'renewal_confirmation',
  'examination_report',
  'opposition_notice',
  'cancellation_notice',
  'euipo_login_notification',
  'ambiguous',
  'other',
] as const;
export type CommunicationType = (typeof COMMUNICATION_TYPES)[number];

// Types the spec allows Bree to act on automatically at HIGH confidence.
export const AUTO_ACT_TYPES: CommunicationType[] = [
  'registration_certificate',
  'renewal_reminder',
  'renewal_confirmation',
];

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export type MentionedDeadline = { date: string; description: string };

export type Classification = {
  registry: Registry;
  communicationType: CommunicationType;
  referenceNumbers: string[];
  deadlinesMentioned: MentionedDeadline[];
  confidence: Confidence;
  summary: string;
};

// What the classifier is given. Content-first: sender is optional/corroborating.
export type EmailInput = {
  subject: string;
  bodyText: string;
  attachmentTexts?: string[];
  fromAddress?: string;
};
