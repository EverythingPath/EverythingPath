'use client';
import { SignInButton, UserButton } from '@clerk/nextjs';
import { Authenticated, AuthLoading, Unauthenticated } from 'convex/react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/utils';
import { LegalFooter } from '~/components/legal/legal-footer';
import { MaintenanceBanner } from './maintenance-banner';

export { OrganizationControl } from './organization-control';

// The page column fills the dynamic viewport so a phone bottom bar sticks to
// its real end while browser chrome collapses, and safe areas pad the edges.
// `bounded` (the Week route at every width) caps the frame at the viewport:
// the top bar, banner and bottom bar keep their natural heights and the
// Week frame scrolls its editor inside the remaining space, so its stepper,
// footer and phone strip stay pinned. It is clipped, not hidden, so focus
// can never scroll the frame itself. Every other page keeps document
// scrolling for its current forms. The maintenance banner sits above the
// top bar on phone and below it from tablet width. The legal footer closes
// every frame: after the page on a document frame, pinned under the Week's
// own footer on a bounded one, and above the phone bottom bar (`footer`)
// in both.
export function ShellFrame({
  header,
  children,
  footer,
  bounded = false,
  withRail = false,
}: {
  header: ReactNode;
  children: ReactNode;
  /** The phone bottom bar; sticks to the viewport's bottom edge. */
  footer?: ReactNode;
  bounded?: boolean;
  withRail?: boolean;
}) {
  return (
    <div
      data-shell-frame={bounded ? 'bounded' : 'document'}
      className={cn(
        'flex min-h-dvh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]',
        bounded && 'h-dvh overflow-clip',
        withRail && 'md:h-dvh md:overflow-clip',
      )}
    >
      <header className="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 z-30 flex shrink-0 flex-col border-b pt-[env(safe-area-inset-top)]">
        <MaintenanceBanner className="order-first md:order-last" />
        {header}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <LegalFooter />
      {footer}
    </div>
  );
}

export function SignIn() {
  const pathname = usePathname();
  return (
    <SignInButton mode="redirect" fallbackRedirectUrl={pathname}>
      <Button size="sm">Sign in</Button>
    </SignInButton>
  );
}

function AccountPlaceholder() {
  return (
    <Skeleton
      role="status"
      aria-label="Loading account"
      className="size-8 rounded-full"
    />
  );
}

// Clerk renders the avatar button asynchronously after Convex auth settles, so
// the same placeholder also stands in as the `UserButton` fallback. The slot
// keeps the placeholder's footprint until Clerk has rendered the avatar, so
// the top bar never reflows (and, on the Week, never moves the pinned week
// chrome) when the avatar arrives late. Minimum sizes only: the slot still
// grows for the wider Sign in button when signed out.
export function AccountControl() {
  return (
    <span className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center">
      <Authenticated>
        <UserButton fallback={<AccountPlaceholder />} />
      </Authenticated>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <AuthLoading>
        <AccountPlaceholder />
      </AuthLoading>
    </span>
  );
}
