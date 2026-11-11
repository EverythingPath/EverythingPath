'use client';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  GuardedLink,
  plainClick,
} from '~/components/campaign-shell/navigation-guard';
import type { BackLink as CharacterSheetBackLink } from '~/lib/campaign-routes';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';

export type BackLink = {
  /** A trusted origin route, never redirect input. */
  href: CharacterSheetBackLink['href'];
  /** "Sheet" is the Spells page's one way back to its own sheet. */
  label: CharacterSheetBackLink['label'] | 'Sheet';
  onNavigate?: () => void;
};

// The sheet's outer box, shared with its route fallback so nothing jumps
// when the sheet replaces the skeleton. Only a back link sits above the
// body (approved shell, variant C); the sheet's own summary row names the
// Character and pins under the shell's sticky top bar.
export function CharacterSheetFrame({
  back,
  children,
}: {
  /** Absent only in the route fallback, which knows no origin yet. */
  back: BackLink | null;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl p-4 pt-2 md:p-6 md:pt-3">
      <div className="mb-2">
        {back ? (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 min-h-9 px-2"
          >
            <GuardedLink
              href={back.href}
              onClick={(event) => {
                if (back.onNavigate && plainClick(event)) {
                  event.preventDefault();
                  back.onNavigate();
                }
              }}
            >
              <ArrowLeft aria-hidden /> {back.label}
            </GuardedLink>
          </Button>
        ) : (
          <Skeleton aria-hidden className="h-9 w-40" />
        )}
      </div>
      {children}
    </main>
  );
}

// The sheet's shape while it loads: the summary row over the three blocks.
export function CharacterSheetSkeleton({ back }: { back: BackLink | null }) {
  return (
    <CharacterSheetFrame back={back}>
      <div
        role="status"
        aria-label="Loading character sheet…"
        className="space-y-3"
      >
        <div
          aria-hidden
          className="border-foreground/15 flex flex-col gap-2 border-b pb-2 md:flex-row md:items-end md:justify-between"
        >
          <Skeleton className="h-7 w-48" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-12" />
            <Skeleton className="h-10 w-12" />
            <Skeleton className="h-10 w-12" />
          </div>
        </div>
        <Skeleton aria-hidden className="h-20 rounded-none" />
        <Skeleton aria-hidden className="h-40 rounded-none" />
        <Skeleton aria-hidden className="h-64 rounded-none lg:w-5/12" />
      </div>
    </CharacterSheetFrame>
  );
}
