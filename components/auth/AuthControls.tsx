'use client';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';

/**
 * Account + organization controls. The portfolio is scoped to the active org,
 * so the OrganizationSwitcher selects which company's data you see.
 * `hidePersonal` enforces the company-as-customer model (no personal-account
 * context). Provisional top-right placement — folds into a reworked top bar
 * later. New component: Tailwind only.
 */
export function AuthControls() {
  return (
    <div className="fixed right-5 top-2 z-50 flex items-center gap-3 font-sans">
      <OrganizationSwitcher
        hidePersonal
        afterCreateOrganizationUrl="/"
        afterSelectOrganizationUrl="/"
      />
      <UserButton afterSignOutUrl="/sign-in" />
    </div>
  );
}
