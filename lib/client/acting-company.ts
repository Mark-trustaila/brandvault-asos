'use client';

/**
 * Client-side "acting company" for platform admins. When set, API calls carry
 * the x-bv-company-id header so reads + writes act on that company (cross-tenant).
 * Persisted in localStorage; null means "my own org".
 */
export type ActingCompany = { id: string; name: string } | null;

const KEY = 'bv_acting_company';

export function getActingCompany(): ActingCompany {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function setActingCompany(c: ActingCompany): void {
  if (typeof window === 'undefined') return;
  if (c) localStorage.setItem(KEY, JSON.stringify(c));
  else localStorage.removeItem(KEY);
}

/** fetch() that adds the cross-tenant header when an acting company is set. */
export function bvFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const acting = getActingCompany();
  const headers = new Headers(init.headers);
  if (acting) headers.set('x-bv-company-id', acting.id);
  return fetch(input, { ...init, headers });
}
