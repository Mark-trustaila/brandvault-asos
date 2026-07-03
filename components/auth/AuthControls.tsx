'use client';
import { UserButton } from '@clerk/nextjs';

/**
 * Floating account control (sign-out / manage account). Provisional placement —
 * this moves into a reworked top bar alongside the OrganizationSwitcher when
 * tenancy lands (Phase 1 step 3b). New component: Tailwind only.
 */
export function AuthControls() {
  return (
    <div className="fixed right-5 top-2 z-50">
      <UserButton afterSignOutUrl="/sign-in" />
    </div>
  );
}
