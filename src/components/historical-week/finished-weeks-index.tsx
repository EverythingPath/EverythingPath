'use client';
import { ChevronDown, ChevronRight, ChevronUp, History } from 'lucide-react';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/utils';
import {
  currentRowClass,
  focusRingClass,
  indexItemClass,
  phoneDividerClass,
  rowClass,
  skeletonRowCount,
} from './finished-weeks-layout-classes';
import type {
  EarlierWeeksView,
  IndexView,
  WeekRowView,
} from './finished-weeks-types';
import { RecordTime } from './record-time';

// The index column: heading, rows, placeholders and closing lines. Each is a
// grid item of the page; see finished-weeks-layout-classes.ts.

// Phone: the page title; tablet and desktop: the small-caps column label. The
// page's h1 is the record heading "Week N".
export function IndexHeading() {
  return (
    <div className={cn(indexItemClass, phoneDividerClass, 'px-4 py-2 md:py-3')}>
      <h2 className="md:text-muted-foreground text-2xl md:text-xs md:tracking-widest md:uppercase">
        Finished weeks
      </h2>
    </div>
  );
}

function WeekRow({ week }: { week: WeekRowView }) {
  return (
    <GuardedLink
      href={week.href}
      onClick={week.onNavigate}
      aria-current={week.isSelected ? 'page' : undefined}
      className={cn(
        rowClass,
        'hover:bg-foreground/5',
        week.isSelected ? currentRowClass : null,
      )}
    >
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="font-semibold">Week {week.week}</span>
            <RecordTime
              date={week.date}
              className="text-muted-foreground text-xs"
            />
          </span>
          {/* Headlines wrap rather than truncate: the row is the preview. */}
          <span className="text-muted-foreground block text-sm [overflow-wrap:anywhere] md:text-xs">
            {week.headlines.join(' · ')}
          </span>
          {week.marker ? (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <History aria-hidden className="size-3 shrink-0" />
              {week.marker}
            </span>
          ) : null}
        </span>
        {/* The selected row is marked by more than colour: a chevron. On a
            phone it points up, as the row is the expanded one with its record
            below it; on tablet and desktop it points at the pane. */}
        {week.isSelected ? (
          <>
            <ChevronUp aria-hidden className="mt-1 size-4 shrink-0 md:hidden" />
            <ChevronRight
              aria-hidden
              className="mt-1 size-4 shrink-0 max-md:hidden"
            />
          </>
        ) : (
          <ChevronDown
            aria-hidden
            className="text-muted-foreground mt-1 size-4 shrink-0 md:hidden"
          />
        )}
      </span>
    </GuardedLink>
  );
}

// Weeks older than the row below it are not loaded; this sits in their place.
function EarlierWeeks({ item }: { item: EarlierWeeksView }) {
  if (item.status === 'failed')
    return (
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
        <span>Earlier weeks could not be loaded.</span>
        <Button type="button" variant="outline" size="sm" onClick={item.load}>
          Try again
        </Button>
      </div>
    );
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={item.status === 'loading'}
      onClick={item.load}
      className="min-h-11 w-full justify-start rounded-none px-4"
    >
      <ChevronUp aria-hidden />
      {item.status === 'loading' ? 'Loading earlier weeks…' : 'Earlier weeks'}
    </Button>
  );
}

export function IndexSkeleton() {
  return Array.from({ length: skeletonRowCount }, (_, i) => (
    <div
      key={i}
      aria-hidden
      className={cn(
        indexItemClass,
        phoneDividerClass,
        'order-3 space-y-2 px-4 py-3',
      )}
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-48 max-w-full" />
    </div>
  ));
}

// The index rows as grid items. `selectedIndex` orders the phone column.
export function IndexRows({ index }: { index: IndexView }) {
  if (index.status === 'loading') return <IndexSkeleton />;
  if (index.status === 'failed')
    return (
      <div className={cn(indexItemClass, phoneDividerClass, 'order-3 p-4')}>
        <FailedLoadCard noun="Finished weeks" retry={index.retry} />
      </div>
    );
  const selectedIndex = index.items.findIndex(
    (item) => item.kind === 'week' && item.isSelected,
  );
  return (
    <nav aria-label="Finished weeks" className="contents">
      <ol role="list" className="contents">
        {index.items.map((item, i) => (
          <li
            key={
              item.kind === 'week'
                ? `week-${item.week}`
                : `earlier-${item.beforeWeek}`
            }
            className={cn(
              indexItemClass,
              phoneDividerClass,
              selectedIndex >= 0 && i <= selectedIndex ? 'order-1' : 'order-3',
            )}
          >
            {item.kind === 'week' ? (
              <WeekRow week={item} />
            ) : (
              <EarlierWeeks item={item} />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Column-1 items the rows take, for the grid template. */
export function indexRowCount(index: IndexView) {
  if (index.status === 'ready') return index.items.length;
  if (index.status === 'loading') return skeletonRowCount;
  return 1;
}

// The closing lines under the index: the open week and the way back.
export function IndexClosing({
  inProgressWeek,
  returnHref,
}: {
  inProgressWeek: number | null;
  returnHref: string;
}) {
  return (
    <div className={cn(indexItemClass, 'order-3 px-4 py-2 md:py-3')}>
      {inProgressWeek !== null ? (
        <p className="text-muted-foreground text-sm">
          Week {inProgressWeek} is in progress.
        </p>
      ) : null}
      <GuardedLink
        href={returnHref}
        className={cn(
          focusRingClass,
          'inline-block min-h-11 py-2 text-sm underline',
        )}
      >
        Return to current week
      </GuardedLink>
    </div>
  );
}
