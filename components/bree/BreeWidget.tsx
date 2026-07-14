'use client';
import { useEffect, useState, useCallback } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { bvFetch } from '../../lib/client/acting-company';

type Notif = {
  id: string;
  type: 'renewal_alert' | 'status_change' | 'digest';
  title: string;
  body: string;
  trademark: { id: string; markText: string; registryName: string } | null;
  createdAt: string;
  read: boolean;
};

type BreeAnswer =
  | { kind: 'portfolio'; companyName: string; total: number; registered: number; pending: number; published: number; needsAttention: number }
  | { kind: 'renewals'; items: { markText: string; registry: string; dueDate: string; daysRemaining: number }[] }
  | { kind: 'status'; query: string; groups: { markText: string; rows: { registry: string; status: string; nextDeadline?: { type: string; dueDate: string; daysRemaining: number } }[] }[] }
  | { kind: 'help' };

const TYPE_BADGE: Record<Notif['type'], { label: string; cls: string }> = {
  renewal_alert: { label: 'Renewal', cls: 'bg-amber-100 text-amber-800' },
  status_change: { label: 'Status', cls: 'bg-sky-100 text-sky-800' },
  digest: { label: 'Digest', cls: 'bg-slate-100 text-slate-600' },
};

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function BreeWidget() {
  const { breeOpen, setBreeOpen, data, setSelectedTrademark } = useDashboard();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [session, setSession] = useState<{ q: string; a: BreeAnswer }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await bvFetch('/api/notifications');
    if (!res.ok) return;
    const d = await res.json();
    setNotifs(d.items ?? []);
    setUnread(d.unread ?? 0);
  }, []);

  const markRead = useCallback(async (id: string) => {
    setNotifs((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await bvFetch(`/api/notifications/${id}/read`, { method: 'POST' });
  }, []);

  const openMark = useCallback(
    (trademarkId: string | null | undefined) => {
      if (!trademarkId || !data) return;
      const mark = data.trademarks.find((t) => t.id === trademarkId);
      if (mark) setSelectedTrademark(mark);
    },
    [data, setSelectedTrademark]
  );

  const openThread = useCallback(
    (n: Notif) => {
      if (!n.read) markRead(n.id);
      openMark(n.trademark?.id);
    },
    [markRead, openMark]
  );

  // Initial load + deep link (/?notification=id): open panel, mark read, open mark.
  useEffect(() => {
    load();
    const id = new URLSearchParams(window.location.search).get('notification');
    if (!id) return;
    setBreeOpen(true);
    (async () => {
      const res = await bvFetch(`/api/notifications/${id}`);
      if (!res.ok) return; // 404 = not this company's; silently ignore
      const { notification } = await res.json();
      markRead(id);
      openMark(notification?.trademark?.id);
    })();
  }, [load, setBreeOpen, markRead, openMark]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput('');
    const res = await bvFetch('/api/bree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    });
    const { answer } = await res.json();
    setSession((s) => [...s, { q, a: answer }]);
    setBusy(false);
  }

  const filtered = notifs.filter((n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return n.trademark?.markText.toLowerCase().includes(q) || n.type.includes(q) || n.title.toLowerCase().includes(q);
  });

  return (
    <>
      {/* Toggle — floating bottom-right (clear of the crowded Topbar); hidden
          while the panel is open (the panel has its own close button). */}
      {!breeOpen && (
        <button
          onClick={() => setBreeOpen(true)}
          className="fixed bottom-5 right-5 z-[220] flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-slate-700"
        >
          Bree
          {unread > 0 && <span className="rounded-full bg-white px-1.5 text-xs font-bold text-slate-900">{unread}</span>}
        </button>
      )}

      {/* Panel */}
      {breeOpen && (
        <div className="fixed right-0 top-0 z-[210] flex h-screen w-[360px] flex-col border-l border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <span className="font-semibold text-slate-900">Bree</span>
            <button onClick={() => setBreeOpen(false)} className="text-slate-400 hover:text-slate-700" aria-label="Close">✕</button>
          </div>

          <div className="border-b border-slate-100 p-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by mark or type"
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications.</p>
            ) : (
              <ul>
                {filtered.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => openThread(n)}
                      className={`flex w-full items-start gap-2 border-b border-slate-50 px-4 py-2.5 text-left hover:bg-slate-50 ${n.read ? '' : 'bg-slate-50/60'}`}
                    >
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_BADGE[n.type].cls}`}>{TYPE_BADGE[n.type].label}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-800">{n.trademark?.markText ?? n.title}</span>
                        <span className="block truncate text-xs text-slate-500">{n.body}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Session Q&A (ephemeral) */}
          {session.length > 0 && (
            <div className="max-h-56 overflow-y-auto border-t border-slate-200 bg-slate-50 p-3 text-sm">
              {session.map((x, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <div className="text-xs text-slate-500">{x.q}</div>
                  <div className="mt-1 text-slate-800">{renderAnswer(x.a)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-200 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Ask Bree: portfolio, renewals, status ACME"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button onClick={send} disabled={busy} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                {busy ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function renderAnswer(a: BreeAnswer) {
  switch (a?.kind) {
    case 'portfolio':
      return `${a.companyName}: ${a.total} marks · ${a.registered} registered · ${a.pending + a.published} in prosecution · ${a.needsAttention} need attention`;
    case 'renewals':
      return a.items.length
        ? <ul className="list-disc pl-4">{a.items.map((i, k) => <li key={k}>{i.markText} ({i.registry}) — {i.daysRemaining}d · {i.dueDate}</li>)}</ul>
        : 'No upcoming renewals.';
    case 'status':
      return a.groups.length
        ? a.groups.map((g, k) => (
            <div key={k}><b>{g.markText}</b>: {g.rows.map((r) => `${r.registry} ${r.status}`).join(', ')}</div>
          ))
        : 'No matching mark.';
    case 'help':
    default:
      return 'Try: portfolio · renewals · status [mark]';
  }
}
