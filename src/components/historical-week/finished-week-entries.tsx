'use client';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  amberBadgeClass,
  currentRowClass,
  focusRingClass,
  monoBadgeClass,
} from './finished-weeks-layout-classes';
import type {
  AuditEntryView,
  AuditPageView,
  RulesetView,
} from './finished-weeks-types';
import { RecordTime } from './record-time';

function RulesetText({ ruleset }: { ruleset: RulesetView }) {
  switch (ruleset.status) {
    case 'ready':
      return <span>Ruleset {ruleset.version}</span>;
    case 'loading':
      return <span className="italic">Ruleset loading…</span>;
    case 'failed':
      return <span>Ruleset unavailable</span>;
  }
}

// One audit entry. A failed Ruleset gets its own retry beside the entry
// button, so no control nests inside another. The shown entry always carries
// the "showing" chip, so selection is never marked by colour alone; it is
// amber only when the shown entry is not the effective record.
function AuditEntry({ entry }: { entry: AuditEntryView }) {
  return (
    <li className="flex items-center gap-2 pr-2">
      <button
        type="button"
        onClick={entry.select}
        aria-current={entry.isSelected ? 'true' : undefined}
        className={cn(
          focusRingClass,
          'hover:bg-foreground/5 flex min-h-11 min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5 border-l-4 border-transparent px-3 py-2 text-left text-sm [overflow-wrap:anywhere] focus-visible:ring-inset',
          entry.isSelected ? currentRowClass : null,
        )}
      >
        <span className="text-muted-foreground font-mono text-xs">
          {entry.label}
        </span>
        <span className="font-medium">{entry.provenance}</span>
        <RecordTime date={entry.date} className="text-muted-foreground" />
        <span className="text-muted-foreground">
          <RulesetText ruleset={entry.ruleset} />
        </span>
        {entry.isEffective ? (
          <Badge variant="outline" className={monoBadgeClass}>
            effective
          </Badge>
        ) : null}
        {entry.isSelected ? (
          <Badge
            variant="outline"
            className={entry.isEffective ? monoBadgeClass : amberBadgeClass}
          >
            showing
          </Badge>
        ) : null}
      </button>
      {entry.ruleset.status === 'failed' ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Try loading the Ruleset for ${entry.label} again`}
          onClick={entry.ruleset.retry}
        >
          Try again
        </Button>
      ) : null}
    </li>
  );
}

// The entries list under the record header, open via the "N entries" button.
export function FinishedWeekEntries({
  id,
  week,
  page,
}: {
  id: string;
  week: number;
  page: AuditPageView;
}) {
  return (
    <div id={id} className="bg-card border-foreground/20 border">
      {page.status === 'loading' ? (
        <p role="status" className="text-muted-foreground px-3 py-2 text-sm">
          Loading entries…
        </p>
      ) : null}
      {page.status === 'failed' ? (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <span>Entries could not be loaded.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={page.retry}
          >
            Try again
          </Button>
        </div>
      ) : null}
      {page.status === 'ready' ? (
        <>
          <ol
            aria-label={`Entries for week ${week}`}
            className="divide-foreground/10 divide-y"
          >
            {page.entries.map((entry) => (
              <AuditEntry key={entry.recordId} entry={entry} />
            ))}
          </ol>
          {page.earlier ? (
            <div className="border-foreground/10 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={page.earlier}
                className="min-h-11 w-full justify-start rounded-none px-3"
              >
                Earlier entries
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
