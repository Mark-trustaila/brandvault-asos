'use client';
import { useEffect, useState } from 'react';
import { bvFetch, getActingCompany } from '../../../lib/client/acting-company';

const STATUSES = ['Registered', 'Pending', 'Published', 'Expired', 'Abandoned'] as const;

type Row = {
  markText: string;
  registryName: string;
  status: string;
  applicationNumber: string;
  filingDate: string;
  registrationDate: string;
  expiryDate: string;
};

const emptyRow = (): Row => ({
  markText: '',
  registryName: '',
  status: 'Pending',
  applicationNumber: '',
  filingDate: '',
  registrationDate: '',
  expiryDate: '',
});

type Result = { createdCount: number; errors: Array<{ index: number; error: string }> };

/**
 * Bulk mark entry (concierge onboarding). Table-style rapid entry into the
 * acting company; submits to /api/trademarks/bulk. New page: Tailwind only.
 */
export default function BulkEntryPage() {
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState('your organization');
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const acting = getActingCompany();
    if (acting) {
      setTarget(acting.name);
    } else {
      fetch('/api/me')
        .then((r) => r.json())
        .then((m) => m.company?.name && setTarget(m.company.name))
        .catch(() => {});
    }
  }, []);

  const update = (i: number, field: keyof Row, val: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));

  const submit = async () => {
    const marks = rows
      .filter((r) => r.markText.trim() && r.registryName.trim())
      .map((r) => ({
        markText: r.markText.trim(),
        registryName: r.registryName.trim(),
        status: r.status,
        applicationNumber: r.applicationNumber.trim() || undefined,
        filingDate: r.filingDate || undefined,
        registrationDate: r.registrationDate || undefined,
        expiryDate: r.expiryDate || undefined,
      }));
    if (marks.length === 0) {
      window.alert('Add at least one mark with a name and registry.');
      return;
    }
    setSubmitting(true);
    const res = await bvFetch('/api/trademarks/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marks, reason: reason.trim() || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      window.alert(e.error || 'Bulk create failed');
      return;
    }
    const data: Result = await res.json();
    setResult(data);
    if (data.errors.length === 0) setRows([emptyRow(), emptyRow(), emptyRow()]);
  };

  const inputCls = 'w-full rounded border border-line bg-surface px-1.5 py-1 text-xs text-ink';

  return (
    <div className="min-h-screen bg-surface-subtle p-8 font-sans text-ink">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="text-xs text-ink-muted hover:text-ink">
          ← Back to dashboard
        </a>
        <h1 className="mt-2 text-xl font-semibold">Bulk mark entry</h1>
        <p className="mb-4 text-sm text-ink-muted">
          Entering marks for <span className="font-medium text-ink">{target}</span>. Only mark, registry,
          and status are required — the rest can be filled in later.
        </p>

        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full text-xs">
            <thead className="bg-surface-muted text-left text-ink-muted">
              <tr>
                <th className="p-2 font-medium">Mark *</th>
                <th className="p-2 font-medium">Registry *</th>
                <th className="p-2 font-medium">Status *</th>
                <th className="p-2 font-medium">App no.</th>
                <th className="p-2 font-medium">Filing</th>
                <th className="p-2 font-medium">Registration</th>
                <th className="p-2 font-medium">Expiry</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-1.5"><input className={inputCls} value={r.markText} onChange={(e) => update(i, 'markText', e.target.value)} /></td>
                  <td className="p-1.5"><input className={inputCls} value={r.registryName} onChange={(e) => update(i, 'registryName', e.target.value)} placeholder="UKIPO" /></td>
                  <td className="p-1.5">
                    <select className={inputCls} value={r.status} onChange={(e) => update(i, 'status', e.target.value)}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-1.5"><input className={inputCls} value={r.applicationNumber} onChange={(e) => update(i, 'applicationNumber', e.target.value)} /></td>
                  <td className="p-1.5"><input type="date" className={inputCls} value={r.filingDate} onChange={(e) => update(i, 'filingDate', e.target.value)} /></td>
                  <td className="p-1.5"><input type="date" className={inputCls} value={r.registrationDate} onChange={(e) => update(i, 'registrationDate', e.target.value)} /></td>
                  <td className="p-1.5"><input type="date" className={inputCls} value={r.expiryDate} onChange={(e) => update(i, 'expiryDate', e.target.value)} /></td>
                  <td className="p-1.5 text-center">
                    <button onClick={() => removeRow(i)} className="text-ink-subtle hover:text-status-expired" title="Remove row">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button onClick={addRow} className="rounded border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink">
            + Add row
          </button>
          <input
            className="flex-1 rounded border border-line bg-surface px-2 py-1 text-xs text-ink"
            placeholder="Reason (required when acting as a platform admin)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded bg-brand px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save marks'}
          </button>
        </div>

        {result && (
          <div className="mt-4 rounded-md border border-line bg-surface p-3 text-xs">
            <div className="font-medium text-status-registered">Created {result.createdCount} mark(s).</div>
            {result.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-status-expired">
                {result.errors.map((e) => (
                  <li key={e.index}>Row {e.index + 1}: {e.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
