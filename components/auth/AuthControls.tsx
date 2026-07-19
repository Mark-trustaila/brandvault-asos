'use client';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';

/**
 * Account + organization controls. The portfolio is scoped to the active org,
 * so the OrganizationSwitcher selects which company's data you see.
 * `hidePersonal` enforces the company-as-customer model (no personal-account
 * context). Rendered inline in the Topbar's right cluster (normal flow), so it
 * no longer overlays the Topbar buttons. New component: Tailwind only.
 */
export function AuthControls() {
  return (
    <div className="flex items-center gap-3 font-sans">
      <OrganizationSwitcher
        hidePersonal
        afterCreateOrganizationUrl="/"
        afterSelectOrganizationUrl="/"
      />
      <UserButton afterSignOutUrl="/sign-in" />
    </div>
  );
}
