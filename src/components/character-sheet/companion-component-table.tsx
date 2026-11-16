'use client';
import { TriangleAlert } from 'lucide-react';
import { cn } from '~/lib/utils';
import { fieldLabel, missingChoice } from './sheet-parts';

const heading = cn(fieldLabel, 'px-2 pb-1 text-left font-normal');
/** A table cell from 768px; a labelled line of the component's card below. */
const cell =
  'max-md:flex max-md:items-baseline max-md:gap-1.5 md:px-2 md:py-1 md:align-top';
// A ruled row from 768px; a bordered card on the phone.
const row =
  'max-md:border-foreground/20 max-md:bg-card max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-0.5 max-md:border max-md:p-3 md:border-foreground/10 md:border-b';

/** A component's number, or “Unresolved” while it is not calculated. */
export function componentValue(value: number | null) {
  return value === null ? 'Unresolved' : String(value);
}

export type ComponentTableCell = {
  /** The column, repeated on the phone where the header row is hidden. */
  column: string;
  value: string;
  /** Not calculated now, outlined as a choice the sheet still needs. */
  isMissing?: boolean;
  isMuted?: boolean;
};
export type ComponentTableRow = {
  key: string;
  label: string;
  cells: ComponentTableCell[];
  /** Amber and advisory: nothing is trimmed. */
  isOverBudget?: boolean;
  /** Muted lines beneath the row's name, such as what it leaves out. */
  notes?: readonly string[];
};

/**
 * One divided component per row (#419): its numbers side by side as a
 * compact table from 768px and stacked as cards below, where each number
 * repeats its column. Over budget turns the row amber; a missing number
 * carries the sheet's outline for a choice it still needs. The Combined
 * Form (#421) reads its fused abilities through the same table.
 */
export function CompanionComponentTable({
  label,
  rowHeading = 'Component',
  columns,
  rows,
}: {
  label: string;
  /** What the row names are: Component unless told otherwise. */
  rowHeading?: string;
  columns: readonly string[];
  rows: readonly ComponentTableRow[];
}) {
  return (
    <table
      role="table"
      aria-label={label}
      className="w-full border-collapse text-sm max-md:block"
    >
      <thead role="rowgroup" className="max-md:hidden">
        <tr role="row" className="border-foreground/20 border-b">
          <th role="columnheader" scope="col" className={heading}>
            {rowHeading}
          </th>
          {columns.map((column) => (
            <th
              key={column}
              role="columnheader"
              scope="col"
              className={cn(heading, 'md:text-right')}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody
        role="rowgroup"
        className="max-md:flex max-md:flex-col max-md:gap-2"
      >
        {rows.map((item) => (
          <tr
            key={item.key}
            role="row"
            className={cn(row, item.isOverBudget && 'text-amber-300')}
          >
            <th
              role="rowheader"
              scope="row"
              className={cn(
                cell,
                'text-left font-normal max-md:w-full max-md:flex-wrap max-md:items-center',
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                {item.isOverBudget ? (
                  <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                ) : null}
                {item.label}
              </span>
              {item.notes?.map((line) => (
                <span
                  key={line}
                  className="text-muted-foreground block text-xs [overflow-wrap:anywhere] max-md:basis-full"
                >
                  {line}
                </span>
              ))}
            </th>
            {item.cells.map((entry) => (
              <td
                key={entry.column}
                role="cell"
                className={cn(
                  cell,
                  'font-mono tabular-nums md:text-right',
                  entry.isMuted && 'text-muted-foreground',
                )}
              >
                <span className={cn(fieldLabel, 'md:hidden')}>
                  {entry.column}
                </span>
                <span className={cn(entry.isMissing && missingChoice)}>
                  {entry.value}
                </span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
