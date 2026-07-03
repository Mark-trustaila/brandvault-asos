import { SignIn } from '@clerk/nextjs';

// New component — Tailwind only (per the CSS rule in CLAUDE.md).
export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted font-sans">
      <SignIn />
    </div>
  );
}
