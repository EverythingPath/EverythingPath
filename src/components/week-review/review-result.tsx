'use client';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { resultCellText, shownRows } from './review-comparison';
import type {
  ResultCell,
  ResultRow,
  ReviewMode,
  WeekReviewFacts,
} from './review-facts';
import { Frame, SectionNumber, wrap } from './review-parts';

// Section 6. The only state in the week renderer is the "Show all values"
// toggle. Both the table and the stacked list are always in the DOM; the
// section's own width (a container query), not the viewport, decides which
// shows, so a narrow pane beside another column stacks its values too.

type Columns = readonly [string, string, string];

function resultColumns(mode: ReviewMode): Columns {
  return [
    mode === 'live' ? 'Now' : 'At confirmation',
    'Rules Baseline',
    'Final',
  ];
}

function rowCells(row: ResultRow) {
  return [row.now, row.baseline, row.final] as const;
}

function ShowAllToggle({
  pressed,
  onToggle,
}: {
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={pressed}
      onClick={onToggle}
    >
      Show all values
    </Button>
  );
}

function Cell({
  cell,
  emphasised,
}: {
  cell: ResultCell;
  emphasised?: boolean;
}) {
  return (
    <span
      className={cn(
        'font-mono',
        wrap,
        cell.kind !== 'value' && 'text-muted-foreground',
        emphasised && 'text-primary font-semibold',
      )}
    >
      {resultCellText(cell)}
    </span>
  );
}

function ResultTableRow({
  row,
  columns,
}: {
  row: ResultRow;
  columns: Columns;
}) {
  return (
    <tr className="border-b last:border-b-0">
      <td className={cn('py-1.5 align-top', wrap)}>
        <span className="text-muted-foreground text-xs">{row.group} · </span>
        {row.label}
        {row.difference && (
          <span className="text-muted-foreground block text-xs">
            {row.difference}
          </span>
        )}
      </td>
      {rowCells(row).map((cell, index) => (
        <td key={columns[index]} className="py-1.5 pl-3 text-right align-top">
          <Cell cell={cell} emphasised={index === 2 && row.finalDiffers} />
        </td>
      ))}
    </tr>
  );
}

function ResultTable({
  rows,
  columns,
}: {
  rows: ResultRow[];
  columns: Columns;
}) {
  return (
    <table className="hidden w-full table-fixed text-sm @lg:table">
      {/* The label keeps a readable share; long recorded values wrap. */}
      <colgroup>
        <col className="w-[31%]" />
        <col />
        <col />
        <col />
      </colgroup>
      <thead className="text-muted-foreground text-xs tracking-wider uppercase">
        <tr className="border-b">
          <th scope="col" className="py-1 text-left font-normal">
            Value
          </th>
          {columns.map((column) => (
            <th
              key={column}
              scope="col"
              className="py-1 pl-3 text-right font-normal"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <ResultTableRow key={row.key} row={row} columns={columns} />
        ))}
      </tbody>
    </table>
  );
}

function ResultListItem({
  row,
  columns,
}: {
  row: ResultRow;
  columns: Columns;
}) {
  return (
    <li className="min-w-0 border p-3 text-sm">
      <p className={wrap}>
        <span className="text-muted-foreground text-xs">{row.group} · </span>
        {row.label}
      </p>
      <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
        {rowCells(row).map((cell, index) => (
          <div key={columns[index]} className="contents">
            <dt className="text-muted-foreground text-xs">{columns[index]}</dt>
            <dd className="min-w-0 text-right">
              <Cell cell={cell} emphasised={index === 2 && row.finalDiffers} />
            </dd>
          </div>
        ))}
      </dl>
      {row.difference && (
        <p className={cn('text-muted-foreground mt-1 text-xs', wrap)}>
          {row.difference}
        </p>
      )}
    </li>
  );
}

function ResultList({
  rows,
  columns,
}: {
  rows: ResultRow[];
  columns: Columns;
}) {
  return (
    <ul className="min-w-0 space-y-2 @lg:hidden">
      {rows.map((row) => (
        <ResultListItem key={row.key} row={row} columns={columns} />
      ))}
    </ul>
  );
}

export function Result({
  result,
  mode,
}: {
  result: WeekReviewFacts['result'];
  mode: ReviewMode;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = shownRows(result.rows, showAll);
  const columns = resultColumns(mode);
  return (
    <Frame
      label="Result"
      className="@container"
      heading={
        <>
          <SectionNumber>6</SectionNumber>Result · week {result.nextWeek}{' '}
          {mode === 'live' ? 'begins' : 'began'}
        </>
      }
      right={
        <ShowAllToggle
          pressed={showAll}
          onToggle={() => setShowAll((value) => !value)}
        />
      }
    >
      {!result.complete && (
        <p className="text-muted-foreground text-sm">
          {mode === 'live'
            ? 'The Rules Baseline and Final are not available until every required decision is made.'
            : 'Some values were not included in this record.'}
        </p>
      )}
      {rows.length === 0 ? (
        result.complete ? (
          <p className="text-muted-foreground text-sm">
            No values change this week.
          </p>
        ) : null
      ) : (
        <>
          <ResultTable rows={rows} columns={columns} />
          <ResultList rows={rows} columns={columns} />
        </>
      )}
    </Frame>
  );
}
