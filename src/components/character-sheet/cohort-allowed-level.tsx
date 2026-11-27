'use client';
import { useId } from 'react';
import { cn } from '~/lib/utils';
import type { buildCohortView } from './character-cohort-view-model';
import { CombinedFormFact } from './combined-form-fact';
import { fieldLabel, noteText, unresolvedValue } from './sheet-parts';

type Leadership = NonNullable<
  NonNullable<ReturnType<typeof buildCohortView>>['leadership']
>;

const fallbackHint = 'Enter a fallback in the cohort’s Companion Relationship.';

/**
 * The level the leader allows (#417), from the leader's values as the
 * cohort's relationship borrows them. The headline is two or more levels
 * below the leader, the limit that persists after recruitment; each input
 * and where it comes from, the recorded modifiers, the Leadership Score and
 * the level it would attract now follow as information. The fallback
 * editor stays with the linked values under the relationship; this only
 * points there.
 */
export function CohortAllowedLevel({ leadership }: { leadership: Leadership }) {
  const modifiersId = useId();
  const needsFallback = leadership.inputs.some(
    (input) => input.resolution === 'unresolved',
  );
  return (
    <div className="flex flex-col gap-2">
      <dl
        aria-label="Allowed level"
        className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4"
      >
        <CombinedFormFact
          label="Allowed level"
          value={leadership.allowedLabel}
          valueClassName="text-xl"
          className="col-span-2 sm:col-span-3 lg:col-span-4"
        >
          <span className={noteText}>Two or more levels below the leader</span>
          {leadership.permanentAllowedLabel ? (
            <span className={noteText}>
              Without temporary effects: {leadership.permanentAllowedLabel}
            </span>
          ) : null}
        </CombinedFormFact>
        {leadership.inputs.map((input) => (
          <CombinedFormFact
            key={input.label}
            label={input.label}
            value={input.display}
          >
            {input.resolutionLabel !== 'Calculated' ? (
              <span className={noteText}>{input.resolutionLabel}</span>
            ) : null}
          </CombinedFormFact>
        ))}
        <div className="col-span-2 flex min-w-0 flex-col sm:col-span-1 lg:col-span-2">
          <dt id={modifiersId} className={fieldLabel}>
            Leadership modifiers
          </dt>
          <dd aria-labelledby={modifiersId}>
            {leadership.modifiers.length > 0 ? (
              <ul
                aria-label="Leadership modifiers"
                className="flex flex-col gap-0.5 text-sm"
              >
                {leadership.modifiers.map((modifier) => (
                  <li
                    key={modifier.key}
                    className="flex flex-wrap justify-between gap-x-2"
                  >
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {modifier.label}
                    </span>
                    <span className="font-mono tabular-nums">
                      {modifier.display}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted-foreground text-sm">
                {leadership.areModifiersUndisclosed ? 'Unavailable' : 'None'}
              </span>
            )}
          </dd>
        </div>
        <CombinedFormFact
          label="Leadership Score"
          value={
            leadership.score === null
              ? unresolvedValue
              : String(leadership.score)
          }
        />
        <CombinedFormFact
          label="Leadership Score would attract now"
          value={leadership.scoreLevelLabel}
        >
          {leadership.permanentScoreLevelLabel ? (
            <span className={noteText}>
              Without temporary effects: {leadership.permanentScoreLevelLabel}
            </span>
          ) : null}
        </CombinedFormFact>
      </dl>
      {needsFallback ? (
        <p className={cn('text-xs', 'text-sky-300')}>{fallbackHint}</p>
      ) : null}
      <p className={noteText}>{leadership.summary}</p>
    </div>
  );
}
