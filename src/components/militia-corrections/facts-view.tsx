import { Fragment } from 'react';
import type { EntryFacts, FactRow } from '~/lib/militia-section-facts';
import { cn } from '~/lib/utils';

// Read-only facts of one Militia page entry. Nothing here is editable: this
// is also the Week & carried effects view and each side of a conflict.
function Rows({ rows }: { rows: FactRow[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 md:grid-cols-[max-content_minmax(0,1fr)]">
      {rows.map((row) => (
        <Fragment key={`${row.label}:${row.value}`}>
          <dt className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]">
            {row.label}
          </dt>
          <dd className="min-w-0 [overflow-wrap:anywhere] max-md:mb-2">
            {row.value}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function FactsView({
  facts,
  className,
}: {
  facts: EntryFacts;
  className?: string;
}) {
  return (
    <div className={cn('space-y-5', className)}>
      {facts.groups.map((group) => {
        const empty = group.rows.length === 0 && group.entries.length === 0;
        return (
          <div key={group.key} className="space-y-2">
            {group.title && (
              <h3 className="text-sm font-semibold">{group.title}</h3>
            )}
            {group.rows.length > 0 && <Rows rows={group.rows} />}
            {group.entries.length > 0 && (
              <ul role="list" className="space-y-2">
                {group.entries.map((entry) => (
                  <li
                    key={entry.key}
                    className="border-foreground/15 bg-card min-w-0 space-y-2 border p-3"
                  >
                    <h4 className="font-medium [overflow-wrap:anywhere]">
                      {entry.title}
                    </h4>
                    {entry.rows.length > 0 && <Rows rows={entry.rows} />}
                  </li>
                ))}
              </ul>
            )}
            {empty && (
              <p className="text-muted-foreground text-sm">{group.empty}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
