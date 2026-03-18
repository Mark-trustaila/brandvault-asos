import type { Trademark, Obligation } from '../types/trademark';

export const BADGE_COLORS = ['#2e6b8a','#6940a5','#0f7b6c','#c4823f','#8b5e3c','#5a7d5a','#b85450','#4a6fa5'];
export const NICE_CLASS_COLORS = ['#2e6b8a','#6940a5','#0f7b6c','#c4823f','#8b5e3c'];

export const getInitials = (str: string): string =>
  str?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'NA';

export const calculateDaysRemaining = (expiryDate?: string): number => {
  if (!expiryDate) return 9999;
  const expiry = new Date(expiryDate);
  const today = new Date();
  return Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const getDaysBadgeStyle = (days: number): { bg: string; color: string; text: string } => {
  if (days <= 90) return { bg: 'rgba(235,87,87,0.08)', color: '#eb5757', text: `${days}d` };
  if (days <= 180) return { bg: '#f2994a', color: '#fff', text: `${days}d` };
  if (days <= 365) return { bg: 'rgba(15,123,108,0.08)', color: '#0f7b6c', text: `${days}d` };
  return { bg: '#f0efec', color: '#9b9a97', text: `${days}d` };
};

export const getStatusStyle = (status: string): { bg: string; color: string } => {
  const map: Record<string, { bg: string; color: string }> = {
    'Registered': { bg: 'rgba(15,123,108,0.08)', color: '#0f7b6c' },
    'Pending': { bg: 'rgba(242,153,74,0.08)', color: '#f2994a' },
    'Published': { bg: 'rgba(46,107,138,0.08)', color: '#2e6b8a' },
    'Expired': { bg: 'rgba(235,87,87,0.08)', color: '#eb5757' },
    'Abandoned': { bg: 'rgba(235,87,87,0.08)', color: '#eb5757' },
  };
  return map[status] || { bg: '#f0efec', color: '#9b9a97' };
};

export const matchesSearch = (trademark: Trademark, query: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (trademark.mark_text || '').toLowerCase().includes(q) ||
    (trademark.application_number || '').toLowerCase().includes(q) ||
    (trademark.registration_number || '').toLowerCase().includes(q) ||
    (trademark.registry_name || '').toLowerCase().includes(q) ||
    (trademark.status || '').toLowerCase().includes(q) ||
    (trademark.client_agent_name || '').toLowerCase().includes(q)
  );
};

const REGISTRY_OBLIGATIONS: Record<string, Array<{
  type: string; yearsAfterReg: number; window: number;
  desc: string; critical: boolean; recurring?: number;
}>> = {
  'USPTO': [
    { type: 'Declaration of Use', yearsAfterReg: 5, window: 1, desc: 'Section 8 Declaration of Continued Use (Years 5-6)', critical: true },
    { type: 'Incontestability', yearsAfterReg: 5, window: 1, desc: 'Section 15 Declaration of Incontestability (Years 5-6)', critical: false },
    { type: 'Renewal + Declaration', yearsAfterReg: 10, window: 1, desc: 'Section 8 & 9 Combined Renewal and Declaration', critical: true, recurring: 10 }
  ],
  'UKIPO': [{ type: 'Renewal', yearsAfterReg: 10, window: 0.5, desc: 'Renewal due every 10 years from filing date', critical: true, recurring: 10 }],
  'EUIPO': [
    { type: 'Renewal', yearsAfterReg: 10, window: 0.5, desc: 'Renewal due every 10 years from filing date', critical: true, recurring: 10 },
    { type: 'Proof of Use', yearsAfterReg: 5, window: 0, desc: 'Vulnerable to revocation for non-use after 5 years', critical: false }
  ],
  'WIPO': [{ type: 'Renewal', yearsAfterReg: 10, window: 0.5, desc: 'Madrid Protocol renewal every 10 years', critical: true, recurring: 10 }],
  'INPI': [{ type: 'Renewal', yearsAfterReg: 10, window: 0.5, desc: 'Renewal every 10 years', critical: true, recurring: 10 }],
  'IPOS': [{ type: 'Renewal', yearsAfterReg: 10, window: 0.5, desc: 'Renewal every 10 years', critical: true, recurring: 10 }],
  'IP Australia': [{ type: 'Renewal', yearsAfterReg: 10, window: 0.5, desc: 'Renewal every 10 years', critical: true, recurring: 10 }],
};

export const getObligationsForTrademark = (trademark: Trademark): Obligation[] => {
  const rules = REGISTRY_OBLIGATIONS[trademark.registry_name] || [];
  const regDate = trademark.registration_date ? new Date(trademark.registration_date) : null;
  if (!regDate) return [];
  const obligations: Obligation[] = [];
  const now = new Date();

  rules.forEach(rule => {
    const maxYears = rule.recurring ? 100 : rule.yearsAfterReg;
    for (let yr = rule.yearsAfterReg; yr <= maxYears; yr += (rule.recurring || maxYears + 1)) {
      const dueDate = new Date(regDate);
      dueDate.setFullYear(dueDate.getFullYear() + yr);
      const windowStart = new Date(dueDate);
      windowStart.setMonth(windowStart.getMonth() - (rule.window * 12));
      const daysUntil = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil < -365) continue;
      if (daysUntil > 365 * 15) break;
      obligations.push({
        type: rule.type, desc: rule.desc, dueDate, windowStart, daysUntil,
        critical: rule.critical,
        actionable: daysUntil <= 180 && daysUntil > 0,
        overdue: daysUntil < 0,
        inWindow: now >= windowStart && daysUntil > 0
      });
    }
  });

  return obligations.sort((a, b) => a.daysUntil - b.daysUntil);
};
