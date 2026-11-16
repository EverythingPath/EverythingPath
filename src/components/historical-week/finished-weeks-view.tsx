'use client';
import type { CSSProperties, ReactNode } from 'react';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { cn } from '~/lib/utils';
import { ActionLink } from './action-link';
import { FinishedWeekPane, PaneSkeleton } from './finished-week-pane';
import {
  IndexClosing,
  IndexHeading,
  IndexRows,
  IndexSkeleton,
  indexRowCount,
} from './finished-weeks-index';
import {
  indexItemClass,
  paneSlotClass,
  skeletonRowCount,
} from './finished-weeks-layout-classes';
import type { FinishedWeeksView, RecordPaneView } from './finished-weeks-types';

// The page grid; see finished-weeks-layout-classes.ts for how the index and
// the pane share it at every width.
function PageGrid({
  indexRows,
  children,
}: {
  /** Column-1 items: heading, rows or placeholders, closing lines. */
  indexRows: number;
  children: ReactNode;
}) {
  return (
    <main
      // Safe cast: CSSProperties has no custom properties; --index-rows is a
      // number React writes as is.
      style={{ '--index-rows': indexRows } as CSSProperties}
      className="mx-auto grid w-full max-w-[90rem] flex-1 grid-cols-1 content-start md:grid-cols-[20rem_minmax(0,1fr)] md:grid-rows-[repeat(var(--index-rows),auto)_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)]"
    >
      {children}
    </main>
  );
}

function NoWeeksPage({ action }: { action: ReactNode }) {
  return (
    <PageGrid indexRows={2}>
      <IndexHeading />
      <p
        className={cn(
          indexItemClass,
          'text-muted-foreground order-3 px-4 py-3',
        )}
      >
        No finished weeks yet.
      </p>
      <div className={paneSlotClass}>{action}</div>
    </PageGrid>
  );
}

// The page's shape while the finished weeks load; also the section's route
// fallback, so the grid is already in place when the page arrives.
export function FinishedWeeksSkeleton() {
  return (
    <PageGrid indexRows={1 + skeletonRowCount}>
      <p role="status" className="sr-only">
        Loading history…
      </p>
      <IndexHeading />
      <IndexSkeleton />
      <div className={paneSlotClass}>
        <PaneSkeleton announce={false} />
      </div>
    </PageGrid>
  );
}

export function FinishedWeeksLayout({
  view,
  returnHref,
  renderRecord,
  deleted = false,
}: {
  view: FinishedWeeksView;
  /** The current week's page. */
  returnHref: string;
  /** The record body (facts) for the ready pane. */
  renderRecord: (pane: RecordPaneView) => ReactNode;
  /** A deleted campaign (#710) has no current week or setup to lead to. */
  deleted?: boolean;
}) {
  // The closing lines are a column-1 grid item only when shown.
  const closingRows = deleted ? 0 : 1;
  switch (view.status) {
    case 'loading':
      return <FinishedWeeksSkeleton />;
    case 'failed':
      return (
        <PageGrid indexRows={1 + closingRows}>
          <IndexHeading />
          {deleted ? null : (
            <IndexClosing inProgressWeek={null} returnHref={returnHref} />
          )}
          <div className={paneSlotClass}>
            <FailedLoadCard noun="Finished weeks" retry={view.retry} />
          </div>
        </PageGrid>
      );
    case 'empty':
      return (
        <NoWeeksPage
          action={
            deleted ? null : (
              <ActionLink href={view.weekHref}>
                {view.openWeek === null
                  ? 'Open the current week'
                  : `Open week ${view.openWeek}`}
              </ActionLink>
            )
          }
        />
      );
    case 'no-militia':
      return (
        <NoWeeksPage
          action={
            deleted ? null : (
              <ActionLink href={view.setupHref}>Set up militia</ActionLink>
            )
          }
        />
      );
    case 'ready':
      return (
        <PageGrid indexRows={1 + closingRows + indexRowCount(view.index)}>
          <IndexHeading />
          <IndexRows index={view.index} />
          <div className={paneSlotClass}>
            <FinishedWeekPane pane={view.pane} renderRecord={renderRecord} />
          </div>
          {deleted ? null : (
            <IndexClosing
              inProgressWeek={view.inProgressWeek}
              returnHref={returnHref}
            />
          )}
        </PageGrid>
      );
  }
}
