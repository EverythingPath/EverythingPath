'use client';
import { CombinedFormFact } from './combined-form-fact';
import type { CompanionsController } from './companion-props';
import { keyedByOccurrence } from './keyed-by-occurrence';
import { chip, fieldLabel, noteText } from './sheet-parts';

type CombinedFormView = NonNullable<
  CompanionsController['combinedForm']['view']
>;

/**
 * The eidolon's evolutions as the fused form reads them: whose Hit Dice
 * their effects use, its natural attacks against their maximum with the
 * statement that attacks while fused are not calculated, and each
 * evolution taken.
 */
export function CombinedFormEvolutions({
  evolutions,
}: {
  evolutions: CombinedFormView['evolutions'];
}) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className={fieldLabel}>Evolutions</h4>
      <p className={noteText}>{evolutions.hitDiceNote}</p>
      <dl className="flex flex-col gap-1">
        <CombinedFormFact label="Natural attacks" value={evolutions.attacks}>
          <span className={noteText}>{evolutions.attacksNote}</span>
        </CombinedFormFact>
      </dl>
      {evolutions.list.length > 0 ? (
        <ul aria-label="Evolutions" className="flex flex-wrap gap-1">
          {keyedByOccurrence(evolutions.list, (evolution) => evolution).map(
            ({ key, item: evolution }) => (
              <li key={key} className={chip}>
                {evolution}
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className={noteText}>None.</p>
      )}
    </div>
  );
}
