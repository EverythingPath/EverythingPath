import type { ReactNode } from 'react';
import { KeepIcon } from '~/components/keepIcon';
import { GuardedLink } from './navigation-guard';

// The top bar's row and its Keep link, kept apart from ShellFrame (which
// pulls in Clerk and Convex) so public pages such as the legal notices share
// the same chrome without those dependencies.

// Each control keeps a bounded width within the approved single row.
export function TopBarRow({ children }: { children: ReactNode }) {
  return (
    <div
      data-top-bar-row
      className="short:gap-y-0.5 short:py-1 flex min-w-0 items-center gap-x-2 px-3 py-1.5 md:gap-x-4 md:px-4 md:py-2"
    >
      {children}
    </div>
  );
}

export function KeepLink() {
  return (
    <GuardedLink
      href="/campaigns"
      aria-label="Keep: all campaigns"
      className="text-primary hover:text-primary/80 focus-visible:ring-ring/50 shrink-0 rounded-sm outline-none focus-visible:ring-[3px]"
    >
      <KeepIcon className="size-8" />
    </GuardedLink>
  );
}
