'use client';
import { TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import { cn } from '~/lib/utils';
import {
  formatCount,
  type CompanionAllocationPoolView,
} from './character-companion-allocations-view-model';
import { CompanionAllocationMemberRow } from './companion-allocation-member-row';
import {
  CompanionComponentTable,
  componentValue,
  type ComponentTableRow,
} from './companion-component-table';
import { CompanionGroupPurchases } from './companion-group-purchases';
import type {
  CompanionAllocationsController,
  CompanionOpenerProps,
} from './companion-props';
import { blockHeading, chip, fieldLabel } from './sheet-parts';

type ComponentPool = Extract<
  CompanionAllocationPoolView,
  { kind: 'component' }
>;

const heading = cn(fieldLabel, 'px-2 pb-1 text-left font-normal');
const overBudget = 'border-amber-500/60 text-amber-300';
const componentColumns = ['Budget', 'Allocated', 'Remaining'] as const;

/** "3 of 4 Small-eidolon places"; the places alone while a size is unknown. */
function placesLabel({ allowed, used }: ComponentPool['capacity']) {
  const places = formatCount(allowed, 'Small-eidolon place');
  return used === null ? places : `${used} of ${places}`;
}

function componentRow(
  component: ComponentPool['components'][number],
): ComponentTableRow {
  return {
    key: component.key,
    label: component.label,
    isOverBudget: component.overBudget,
    cells: [
      {
        column: 'Budget',
        value: componentValue(component.budget),
        isMuted: component.budget === null,
      },
      { column: 'Allocated', value: String(component.allocated) },
      {
        column: 'Remaining',
        value: componentValue(component.remaining),
        isMuted: component.remaining === null,
      },
    ],
  };
}

/**
 * One divided budget the viewed Character owns: where the budget comes
 * from, the budget, how much is allocated and what is left, an amber
 * advisory when the shares exceed it, the rule's restriction, then each
 * companion's share as a compact table from 768px and stacked cards below,
 * with the published rules it follows. A component budget (#419) adds its
 * brood's places, each component's budget against what is allocated, and
 * the purchases made once for the whole brood.
 */
export function CompanionAllocationPool({
  pool,
  controller,
  reasonId,
  rememberOpener,
}: CompanionOpenerProps & {
  pool: CompanionAllocationPoolView;
  controller: CompanionAllocationsController;
  reasonId: string | undefined;
}) {
  const headingId = useId();
  const hasShares = pool.kind !== 'increase';
  const components = pool.kind === 'component' ? pool : null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id={headingId} className={blockHeading}>
          {pool.label}
        </h3>
        {pool.budgetSourceLabel ? (
          <span className="text-muted-foreground font-mono text-xs">
            {pool.budgetSourceLabel}
          </span>
        ) : null}
      </header>
      <p className="flex flex-wrap items-center gap-1.5">
        <span className={chip}>{pool.budgetLabel}</span>
        <span className={cn(chip, pool.overBudget && overBudget)}>
          {pool.allocatedLabel}
        </span>
        {pool.remainingLabel ? (
          <span
            className={cn(
              chip,
              pool.overBudget ? overBudget : 'text-muted-foreground',
            )}
          >
            {pool.remainingLabel}
          </span>
        ) : null}
        {components ? (
          <span
            className={cn(
              chip,
              components.capacity.overCapacity
                ? overBudget
                : 'text-muted-foreground',
            )}
          >
            {placesLabel(components.capacity)}
          </span>
        ) : null}
      </p>
      {pool.warning ? (
        <p className="flex items-start gap-1.5 text-xs text-amber-300">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {pool.warning}
          </span>
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
        {pool.restriction}
      </p>
      {components ? (
        <>
          <CompanionComponentTable
            label={`${pool.label} components`}
            columns={componentColumns}
            rows={components.components.map(componentRow)}
          />
          <CompanionGroupPurchases
            pool={components}
            controller={controller}
            reasonId={reasonId}
          />
        </>
      ) : null}
      <table
        role="table"
        aria-label={`${pool.label} companions`}
        className="w-full border-collapse text-sm max-md:block"
      >
        <thead role="rowgroup" className="max-md:hidden">
          <tr role="row" className="border-foreground/20 border-b">
            <th role="columnheader" scope="col" className={heading}>
              Companion
            </th>
            {hasShares ? (
              <th role="columnheader" scope="col" className={heading}>
                Share
              </th>
            ) : null}
            <th role="columnheader" scope="col" className={heading}>
              State
            </th>
            {hasShares ? (
              <th role="columnheader" scope="col" className={heading}>
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody
          role="rowgroup"
          className="max-md:flex max-md:flex-col max-md:gap-2"
        >
          {pool.members.map((member) => (
            <CompanionAllocationMemberRow
              key={member.key}
              member={member}
              poolLabel={pool.label}
              controller={controller}
              reasonId={reasonId}
              rememberOpener={rememberOpener}
            />
          ))}
        </tbody>
      </table>
      <div className="flex flex-col gap-1">
        <h4 className={fieldLabel}>Rules</h4>
        <ul aria-label="Rules" className="flex flex-col gap-1 text-sm">
          {pool.citations.map((citation) => (
            <li key={citation} className="[overflow-wrap:anywhere]">
              {citation}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
