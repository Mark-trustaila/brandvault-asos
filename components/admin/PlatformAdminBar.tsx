'use client';
import { useEffect, useState } from 'react';

type Me = {
  isPlatformAdmin: boolean;
  user: { name: string } | null;
  company: { name: string } | null;
};

type AuditEntry = {
  id: string;
  action: string;
  actor: string;
  reason?: string;
  isPlatformAdmin: boolean;
  date: string;
};

/**
 * Platform-admin surface: shows an admin badge and an activity-log flyout
 * backed by /api/audit (where admin actions read as "BrandVault Support").
 * Renders nothing for non-admins. New component: Tailwind only.
 *
 * The cross-tenant company switcher (acting on another company via
 * x-bv-company-id) is the next increment.
 */
export function PlatformAdminBar() {
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then(setMe)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch('/api/audit')
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => {});
  }, [open]);

  if (!me?.isPlatformAdmin) return null;

  return (
    <div className="fixed bottom-3 left-3 z-50 font-sans">
      <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 shadow-sm">
        <span className="rounded bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">Platform admin</span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-ink-muted transition-colors hover:text-ink"
        >
          {open ? 'Hide activity' : 'Activity log'}
        </button>
      </div>

      {open && (
        <div className="mt-2 max-h-96 w-96 overflow-y-auto rounded-md border border-line bg-surface p-3 shadow-lg">
          <div className="mb-2 text-xs font-semibold text-ink">Activity — {me.company?.name ?? '—'}</div>
          {entries.length === 0 ? (
            <div className="text-xs text-ink-muted">No activity yet</div>
          ) : (
            <ul className="space-y-2">
              {entries.map((e) => (
                <li key={e.id} className="border-b border-line pb-2 text-xs last:border-0 last:pb-0">
                  <div>
                    <span className="font-medium text-ink">{e.actor}</span>
                    <span className="text-ink-muted"> · {e.action}</span>
                  </div>
                  {e.reason && <div className="text-ink-muted">“{e.reason}”</div>}
                  <div className="text-ink-subtle">{new Date(e.date).toLocaleString('en-GB')}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
