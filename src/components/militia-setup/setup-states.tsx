'use client';
import type { ReactNode } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { warningText, wrap } from '~/components/week-review/review-parts';
import { SETUP_STEP_KEYS } from '~/lib/setup-steps';
import { cn } from '~/lib/utils';
import type { SetupNotice } from './use-setup-session';

// The states the guided Setup page shows around, or instead of, the form.

// The page's outer frame, shared with the section's route fallback so the
// skeleton and the form sit in the same box.
export function SetupPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6 xl:max-w-7xl">
      <h1 className="text-2xl font-bold">Set up militia</h1>
      {children}
    </main>
  );
}

// Stands in for SetupModeChoice: its label and the two choice buttons.
function ModeChoiceSkeleton() {
  return (
    <div className="space-y-1">
      <Skeleton className="h-4 w-36" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-12 w-32" />
        <Skeleton className="h-12 w-36" />
      </div>
    </div>
  );
}

// The Setup frame while the session loads: from 768px the step index beside
// the detail pane, below it the one list of accordion rows.
export function SetupSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Loading militia setup…</span>
      <div
        aria-hidden
        className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]"
      >
        <div className="space-y-4 md:border-r md:pr-4">
          <ModeChoiceSkeleton />
          <div className="space-y-0.5 max-md:border-t">
            {SETUP_STEP_KEYS.map((key) => (
              <Skeleton
                key={key}
                className="h-12 w-full rounded-none md:h-9 md:rounded-md"
              />
            ))}
          </div>
        </div>
        <div className="hidden min-w-0 flex-col md:flex">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-2/3" />
          </div>
          <div className="mt-6 flex justify-end border-t py-3">
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}

// The militia was already set up when the page loaded.
export function SetupStarted({
  week,
  weekHref,
  militiaHref,
}: {
  week: number | null;
  weekHref: string;
  militiaHref: string;
}) {
  return (
    <Card role="status" className="max-w-xl gap-3 p-4">
      <p>This militia is already set up.</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="min-h-11 max-sm:w-full">
          <GuardedLink href={weekHref}>
            {week === null ? 'Open week' : `Open week ${week}`}
          </GuardedLink>
        </Button>
        <Button asChild variant="outline" className="min-h-11 max-sm:w-full">
          <GuardedLink href={militiaHref}>Open militia</GuardedLink>
        </Button>
      </div>
    </Card>
  );
}

// Another player finished setup while this form was open; the page is on its
// way to the current week.
export function SetupOpening() {
  return (
    <Card role="status" className="max-w-xl flex-row items-center gap-3 p-4">
      <Loader2
        aria-hidden
        className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
      />
      <p className={wrap}>
        Another player started the militia. Opening the week…
      </p>
    </Card>
  );
}

const storageNotices: Record<SetupNotice, string> = {
  unkept: "Your entries won't be kept if you reload or leave this page.",
  notRestored: 'Your earlier entries could not be restored.',
};

// One line above the form about this browser's copy of the entries.
export function SetupStorageNotice({ notice }: { notice: SetupNotice }) {
  return (
    <p
      role="status"
      className="text-muted-foreground flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
    >
      <TriangleAlert
        aria-hidden
        className={cn('mt-0.5 size-4 shrink-0', warningText)}
      />
      <span className={wrap}>{storageNotices[notice]}</span>
    </p>
  );
}
