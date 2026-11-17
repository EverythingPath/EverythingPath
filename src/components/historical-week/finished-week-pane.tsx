'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/utils';
import { ActionLink } from './action-link';
import { FinishedWeekEntries } from './finished-week-entries';
import { amberBadgeClass } from './finished-weeks-layout-classes';
import type {
  PaneView,
  RecordPaneView,
  WeekLink,
} from './finished-weeks-types';
import { RecordTime } from './record-time';

// The six stacked record sections, each keyed by its section.
const skeletonSections = [
  ['upkeep', 'h-28'],
  ['activity', 'h-44'],
  ['event', 'h-24'],
  ['persistent', 'h-24'],
  ['adjustments', 'h-20'],
  ['result', 'h-56'],
] as const;

// `announce` is off when the page already carries its own loading status.
export function PaneSkeleton({ announce = true }: { announce?: boolean }) {
  return (
    <div className="space-y-4">
      {announce ? (
        <p role="status" className="sr-only">
          Loading history…
        </p>
      ) : null}
      <div aria-hidden className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div aria-hidden className="space-y-4">
        {skeletonSections.map(([section, height]) => (
          <Skeleton key={section} className={height} />
        ))}
      </div>
    </div>
  );
}

function WeekArrow({
  link,
  label,
  icon,
}: {
  link: WeekLink;
  label: string;
  icon: ReactNode;
}) {
  if (link === null)
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled
        aria-label={label}
      >
        {icon}
      </Button>
    );
  return (
    <Button asChild variant="outline" size="icon">
      <GuardedLink href={link.href} aria-label={label}>
        {icon}
      </GuardedLink>
    </Button>
  );
}

// The record heading; scrolled into view when a different week is shown,
// including the first time a record appears. Focus is never moved.
function RecordHeading({ id, week }: { id: string; week: number }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [week]);
  return (
    <h1 id={id} ref={ref} className="text-2xl font-semibold">
      Week {week}
    </h1>
  );
}

function ProvenanceLine({ record }: { record: RecordPaneView }) {
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="text-foreground">{record.provenance}</span>
      <span aria-hidden>·</span>
      <RecordTime date={record.date} />
      <span aria-hidden>·</span>
      <span>Ruleset {record.rulesetVersion}</span>
      {record.earlierEntry ? (
        <Badge variant="outline" className={amberBadgeClass}>
          {record.earlierEntry}
        </Badge>
      ) : null}
    </p>
  );
}

function RecordPane({
  record,
  renderRecord,
}: {
  record: RecordPaneView;
  renderRecord: (record: RecordPaneView) => ReactNode;
}) {
  const headingId = useId();
  const entriesId = useId();
  const audit = record.audit;
  return (
    <article aria-labelledby={headingId} className="space-y-4">
      <header className="space-y-3">
        {/* Title left, controls right; on a phone the controls wrap below. */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-56 space-y-1">
            <RecordHeading id={headingId} week={record.week} />
            <ProvenanceLine record={record} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {audit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={audit.isOpen}
                aria-controls={audit.isOpen ? entriesId : undefined}
                onClick={audit.toggle}
                className="min-h-9 max-md:min-h-11"
              >
                <History aria-hidden />
                {audit.entryCount} entries
                <ChevronDown
                  aria-hidden
                  className={cn(
                    'transition',
                    audit.isOpen ? 'rotate-180' : null,
                  )}
                />
              </Button>
            ) : null}
            <WeekArrow
              link={record.previous}
              label="Previous week"
              icon={<ChevronLeft aria-hidden />}
            />
            <WeekArrow
              link={record.next}
              label="Next week"
              icon={<ChevronRight aria-hidden />}
            />
          </div>
        </div>
        {audit?.isOpen ? (
          <FinishedWeekEntries
            id={entriesId}
            week={record.week}
            page={audit.page}
          />
        ) : null}
      </header>
      {renderRecord(record)}
      <footer>
        <p className="text-muted-foreground text-xs">
          Read-only. Recorded when the week was confirmed. Corrections to a
          finished week aren&apos;t available yet.
        </p>
      </footer>
    </article>
  );
}

// The pane in every state: loading, failed, unavailable, or the record.
export function FinishedWeekPane({
  pane,
  renderRecord,
}: {
  pane: PaneView;
  renderRecord: (record: RecordPaneView) => ReactNode;
}) {
  switch (pane.status) {
    case 'loading':
      return <PaneSkeleton />;
    case 'failed':
      return (
        <div className="space-y-4">
          <FailedLoadCard noun="Finished weeks" retry={pane.retry} />
          {pane.effectiveHref ? (
            <ActionLink href={pane.effectiveHref}>
              Show the effective record
            </ActionLink>
          ) : null}
        </div>
      );
    case 'unavailable':
      return (
        <div className="space-y-4">
          <p>{pane.message}</p>
          <ActionLink href={pane.action.href}>{pane.action.label}</ActionLink>
        </div>
      );
    case 'ready':
      return <RecordPane record={pane.pane} renderRecord={renderRecord} />;
  }
}
