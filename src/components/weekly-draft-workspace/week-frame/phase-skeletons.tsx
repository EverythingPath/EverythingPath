import type { ReactNode } from 'react';
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/utils';
import type { Phase } from '../types';

// The editor-column bodies of the loading skeleton, shaped like the editor
// the address names (#143 §7, #144 §8, #145 §8) so the page keeps its shape
// while the week loads. Everything here is decorative: the frame hides it
// from assistive technology and announces one status instead.

export type SkeletonShape = 'event' | 'persistent' | 'summary' | 'week';

// Upkeep and Activity keep the generic two-block body, as does an address
// without a phase.
export function skeletonShape(phase: Phase | undefined): SkeletonShape {
  return phase === 'event' || phase === 'persistent' || phase === 'summary'
    ? phase
    : 'week';
}

export function PhaseSkeletonBody({ shape }: { shape: SkeletonShape }) {
  switch (shape) {
    case 'event':
      return <EventSkeleton />;
    case 'persistent':
      return <PersistentSkeleton />;
    case 'summary':
      return <SummarySkeleton />;
    case 'week':
      return <WeekBody />;
  }
}

function WeekBody() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

// The round numbered marker the Event steps and Persistent sections share.
function Marker({ className }: { className?: string }) {
  return <Skeleton className={cn('size-7 shrink-0 rounded-full', className)} />;
}

// A roll input beside its roll button.
function RollField() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Skeleton className="h-9 w-28" />
      <Skeleton className="h-9 w-20" />
    </div>
  );
}

// Event: the numbered steps of `EventStep` on their left rule (chance roll,
// the event's blocks, the week outcome), each block a bordered card with a
// title and its roll field.
function EventStep({ children }: { children: ReactNode }) {
  return (
    <div
      data-skeleton-step
      className="border-foreground/20 min-w-0 border-l-2 pl-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Marker />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24 sm:ml-auto" />
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function EventBlock() {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <Skeleton className="h-5 w-40 max-w-full" />
      <Skeleton className="h-3 w-56 max-w-full" />
      <RollField />
    </div>
  );
}

function EventSkeleton() {
  return (
    <div className="space-y-6">
      <EventStep>
        <RollField />
      </EventStep>
      <EventStep>
        <EventBlock />
        <EventBlock />
      </EventStep>
      <EventStep>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </EventStep>
    </div>
  );
}

// Persistent: the buyoff overview line, then each event as a numbered
// section on its rule with a row of decision cards; the cards wrap in two
// columns on phone and sit three abreast once the editor is wide enough.
function PersistentSection() {
  return (
    <div
      data-skeleton-section
      className="border-foreground/20 relative min-w-0 border-l-2 pl-6"
    >
      <Marker className="absolute top-0 -left-3.5" />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Skeleton className="h-6 w-40 max-w-full" />
        <Skeleton className="h-4 w-32 max-w-full" />
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-3 pb-2 @xl:grid-cols-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </div>
  );
}

function PersistentSkeleton() {
  return (
    <div className="space-y-6">
      <div data-skeleton-overview className="flex items-start gap-2">
        <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <PersistentSection />
      <PersistentSection />
    </div>
  );
}

// Review & confirm: the "Review the week" card (heading, the warnings list,
// the confirm button) above the six review sections, the last of which is
// the table-like Result.
function WarningLine() {
  return (
    <div className="flex items-start gap-2">
      <Skeleton className="mt-0.5 size-3.5 shrink-0 rounded-full" />
      <Skeleton className="h-4 flex-1" />
    </div>
  );
}

function ReviewBlock() {
  return (
    <div
      data-skeleton-review-block
      className="bg-card space-y-3 rounded-xl border p-5 shadow-sm"
    >
      <Skeleton className="h-6 w-40 max-w-full" />
      <Skeleton className="h-4 w-24" />
      <WarningLine />
      <WarningLine />
      <Skeleton className="h-9 w-36 max-w-full" />
    </div>
  );
}

// The review's sections and their line counts; Result follows as rows.
const reviewSections = [
  ['upkeep', 2],
  ['activity', 2],
  ['event', 1],
  ['persistent', 2],
  ['adjustments', 1],
] as const;

function ReviewSection({ children }: { children: ReactNode }) {
  return (
    <div
      data-skeleton-section
      className="bg-card min-w-0 space-y-3 border p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-baseline gap-2">
        <Skeleton className="h-4 w-6" />
        <Skeleton className="h-5 w-32 max-w-full" />
      </div>
      {children}
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-4">
      <ReviewBlock />
      {reviewSections.map(([name, lines]) => (
        <ReviewSection key={name}>
          {Array.from({ length: lines }, (_, line) => (
            <Skeleton key={line} className="h-4 w-2/3" />
          ))}
        </ReviewSection>
      ))}
      <ReviewSection>
        <div className="divide-border divide-y">
          {Array.from({ length: 3 }, (_, row) => (
            <div key={row} className="flex justify-between gap-3 py-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </ReviewSection>
    </div>
  );
}
