import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCurrentCompany, getCurrentUser } from '../../../lib/tenant';
import { isPlatformAdmin } from '../../../lib/authz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/me — identity for the current session: the synced user, their active
// company, and whether they're a platform admin (so the UI can show admin
// controls like the cross-tenant company switcher).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ authenticated: false });

  const user = await getCurrentUser();
  const company = await getCurrentCompany();
  const platformAdmin = user ? await isPlatformAdmin(user.id) : false;

  return NextResponse.json({
    authenticated: true,
    user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
    company: company ? { id: company.id, name: company.name } : null,
    isPlatformAdmin: platformAdmin,
  });
}
