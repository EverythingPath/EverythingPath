'use client';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import {
  abilityKeys,
  abilityLabels,
  type Ability,
} from '~/lib/character-sheet';
import type { RacialChoiceRowView } from './character-sheet-races-view-model';
import { ChoiceSelect, type ChoiceOption } from './choice-select';
import { racialAbilityScoreCopy } from './racial-ability-score-copy';
import { chip, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

const abilityOptions: ChoiceOption[] = abilityKeys.map((ability) => ({
  value: ability,
  label: `+2 ${abilityLabels[ability]}`,
}));

function isAbility(value: string): value is Ability {
  return abilityKeys.some((ability) => ability === value);
}

/**
 * The +2 of a representative ability-score-choice trait. Unchosen while it
 * counts, it wears the sheet's blue outline and contributes nothing; a
 * retained choice stays visible on a dormant row without counting.
 */
export function RacialAbilityScoreChoice({
  row,
  actions,
}: {
  row: RacialChoiceRowView;
  actions: Controller['races'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const status = actions.statusFor(row.rowId);
  const isDisabled = status.kind === 'saving' || maintenance.readOnly;
  const choice = row.choice !== null && isAbility(row.choice) ? row.choice : '';
  const choices: { key: string; value: string; index: 0 | 1 }[] =
    row.abilityChoiceCount === 2
      ? [
          { key: 'first', value: choice, index: 0 },
          { key: 'second', value: row.secondChoice ?? '', index: 1 },
        ]
      : [{ key: 'first', value: choice, index: 0 }];
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      {choices.map(({ key, value, index }) => (
        <ChoiceSelect
          key={key}
          label={
            choices.length === 2
              ? `${racialAbilityScoreCopy.choiceLabel} ${index + 1}`
              : racialAbilityScoreCopy.choiceLabel
          }
          value={value}
          options={abilityOptions}
          emptyLabel={racialAbilityScoreCopy.choose}
          isMissing={row.counting && value === ''}
          isDim={!row.counting}
          disabled={isDisabled}
          className="w-48"
          onValueChange={(value) => {
            if (isDisabled) return;
            const ability = isAbility(value) ? value : null;
            if (choices.length === 2) {
              void actions.chooseAbilityScore(
                row.target,
                ability,
                row.rowId,
                index === 1 ? 1 : 0,
              );
              return;
            }
            void actions.chooseAbilityScore(row.target, ability, row.rowId);
          }}
        />
      ))}
      {row.counting &&
      choices.length === 2 &&
      choice &&
      choice === row.secondChoice ? (
        <span className="text-sm text-amber-700 dark:text-amber-400">
          Choose two different ability scores.
        </span>
      ) : null}
      {row.counting ? null : <span className={chip}>Not counting now</span>}
      <SaveFeedback
        status={status}
        savedText={racialAbilityScoreCopy.saved}
        savingText="Saving…"
        shouldHideWhenIdle
      />
    </div>
  );
}
