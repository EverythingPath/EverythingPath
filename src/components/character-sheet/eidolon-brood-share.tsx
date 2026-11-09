'use client';
import { TriangleAlert } from 'lucide-react';
import { pointCount } from '~/lib/character-sheet-eidolon-progression';
import type { EidolonProgressionView } from './character-eidolon-progression-view-model';
import {
  CompanionComponentTable,
  componentValue,
  type ComponentTableRow,
} from './companion-component-table';
import { chip, fieldLabel } from './sheet-parts';

type Brood = NonNullable<EidolonProgressionView['ordinary']['brood']>;

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';

function shareRow(
  component: Brood['components'][number],
  hasBrood: boolean,
): ComponentTableRow {
  return {
    key: component.key,
    label: component.label,
    isOverBudget: component.overBudget,
    cells: [
      {
        column: 'This eidolon',
        value: componentValue(component.value),
        isMissing: component.value === null,
        isMuted: component.value === null,
      },
      ...(hasBrood
        ? [
            {
              column: 'Brood budget',
              value: componentValue(component.budget),
              isMuted: component.budget === null,
            },
            {
              column: 'Brood allocated',
              value: componentValue(component.broodTotal),
              isMuted: component.broodTotal === null,
            },
          ]
        : []),
    ],
  };
}

/**
 * A Broodmaster eidolon's share of its brood (#419): each divided component
 * as allocated to this eidolon, beside the whole brood's budget and total
 * while the summoner's sheet is accessible, the largest eidolon the brood
 * allows and the purchases made for the whole brood. Without access only
 * the eidolon's own shares show. Over budget is amber and advisory.
 */
export function EidolonBroodShare({ brood }: { brood: Brood }) {
  // Brood totals and purchases are disclosed together, with access.
  const hasBrood = brood.groupPurchases !== null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4 className={fieldLabel}>Brood share</h4>
        <span className={note}>{brood.budgetLabel}</span>
        {brood.largestSizeLabel ? (
          <span className={chip}>Eidolons up to {brood.largestSizeLabel}</span>
        ) : null}
      </div>
      <CompanionComponentTable
        label="Brood share"
        columns={
          hasBrood
            ? ['This eidolon', 'Brood budget', 'Brood allocated']
            : ['This eidolon']
        }
        rows={brood.components.map((component) =>
          shareRow(component, hasBrood),
        )}
      />
      {hasBrood ? (
        <div className="flex flex-col gap-0.5 pt-1">
          <h5 className={fieldLabel}>Group purchases</h5>
          {brood.groupPurchases?.length ? (
            <ul aria-label="Group purchases" className="flex flex-col gap-0.5">
              {brood.groupPurchases.map((purchase) => (
                <li key={purchase.key} className="flex flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    {purchase.label}
                    <span className={chip}>{pointCount(purchase.cost)}</span>
                  </span>
                  {purchase.issues.map((issue) => (
                    <p
                      key={issue}
                      className="flex items-start gap-1.5 text-xs text-amber-300"
                    >
                      <TriangleAlert
                        aria-hidden
                        className="mt-px size-3.5 shrink-0"
                      />
                      <span className="min-w-0 [overflow-wrap:anywhere]">
                        {issue}
                      </span>
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <p className={note}>None bought for the brood.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
