'use client';
import { cn } from '~/lib/utils';
import type { buildCohortView } from './character-cohort-view-model';
import { CombinedFormFact } from './combined-form-fact';
import { chip, isUnresolvedValue, noteText } from './sheet-parts';

type Equivalence = NonNullable<
  ReturnType<typeof buildCohortView>
>['equivalence'];

/**
 * The cohort's level for Leadership (#417): the number or Unresolved,
 * what it is based on, how it adds up and, for a published creature, the
 * book it comes from. Hit Dice never appear here.
 */
export function CohortEquivalenceFact({
  equivalence,
}: {
  equivalence: Equivalence;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dl
        aria-label="Cohort Equivalence"
        className="flex flex-wrap items-end gap-x-3 gap-y-1"
      >
        <CombinedFormFact
          label="Cohort Equivalence"
          value={equivalence.display}
          valueClassName="text-xl"
        />
        <dd className="pb-0.5">
          <span
            className={cn(
              chip,
              isUnresolvedValue(equivalence.display) && 'text-muted-foreground',
            )}
          >
            {equivalence.basisLabel}
          </span>
        </dd>
      </dl>
      <p className="text-xs [overflow-wrap:anywhere]">{equivalence.summary}</p>
      {equivalence.citationLabel ? (
        <p className={noteText}>{equivalence.citationLabel}</p>
      ) : null}
    </div>
  );
}
