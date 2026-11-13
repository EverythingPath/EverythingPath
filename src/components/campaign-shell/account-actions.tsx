'use client';
import { useClerk, useUser } from '@clerk/nextjs';
import { AuthLoading, Unauthenticated } from 'convex/react';
import { LogOut, UserRound } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { useNavigationGuard } from './navigation-guard';
import { SignIn } from './shell-frame';

// Phone More sheet: explicit account actions instead of the stock avatar
// menu. Clerk's avatar popover cannot be used inside the modal sheet (the
// sheet's focus trap makes the portalled popover unclickable), while Clerk's
// modals coexist with it. Managing the account opens Clerk's own profile
// modal with every account operation; signing out goes through the departure
// guard so pending work gets Stay/Leave, and runs at most once on Leave.
export function AccountActions() {
  const clerk = useClerk();
  const { isLoaded, user } = useUser();
  const guard = useNavigationGuard();
  if (!isLoaded)
    return (
      <Skeleton
        role="status"
        aria-label="Loading account"
        className="h-8 w-40"
      />
    );
  if (!user)
    return (
      <>
        <Unauthenticated>
          <SignIn />
        </Unauthenticated>
        <AuthLoading>
          <Skeleton
            role="status"
            aria-label="Loading account"
            className="h-8 w-40"
          />
        </AuthLoading>
      </>
    );
  const name = user.fullName ?? user.primaryEmailAddress?.emailAddress ?? null;
  const manage = () =>
    guard.requestDeparture({ commit: () => clerk.openUserProfile() });
  const signOut = () =>
    guard.requestDeparture({
      commit: () => clerk.signOut({ redirectUrl: '/campaigns' }),
      failureMessage:
        'Sign-out could not be completed. You are still signed in.',
    });
  return (
    // Failure screenshots mask this block: the name can be an email.
    <div data-account-surface className="flex flex-col gap-2">
      {name && <p className="truncate text-sm">{name}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={manage}>
          <UserRound aria-hidden /> Manage account
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={signOut}>
          <LogOut aria-hidden /> Sign out
        </Button>
      </div>
    </div>
  );
}
