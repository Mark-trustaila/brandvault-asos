/**
 * StatusBadge — reference "new component" for the Tailwind + CSS-Modules split.
 *
 * This is the canonical example of the CSS rule from CLAUDE.md: a NEW component
 * styled entirely with Tailwind utilities and the design tokens in
 * tailwind.config.ts — no .module.css, no inline colours. Existing components
 * keep their CSS Modules; new ones look like this.
 *
 * It maps a trademark status to the `status` colour tokens (which mirror
 * getStatusStyle() in lib/utils.ts) so it stays consistent with the dashboard.
 */
import type { Trademark } from '../../types/trademark';

type Status = Trademark['status'];

const STATUS_CLASSES: Record<Status, string> = {
  Registered: 'bg-status-registered/10 text-status-registered',
  Pending: 'bg-status-pending/10 text-status-pending',
  Published: 'bg-status-published/10 text-status-published',
  Expired: 'bg-status-expired/10 text-status-expired',
  Abandoned: 'bg-status-expired/10 text-status-expired',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium font-sans ${STATUS_CLASSES[status]}`}
    >
      {status}
    </span>
  );
}
