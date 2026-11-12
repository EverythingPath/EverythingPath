'use client';
import {
  abilityKeys,
  abilityLabels,
  abilityTargets,
  type Ability,
  type ResolvedStatistic,
} from '~/lib/character-sheet';
import { racialAbilityScoreCopy } from './racial-ability-score-copy';
import { fieldLabel, formatModifier } from './sheet-parts';
import { SheetStatistic } from './sheet-statistic';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Breakdowns = NonNullable<Controller['sheet']>['calculated']['breakdowns'];

type RacialAbilityScoreAdjustment = {
  ability: Ability;
  racialTotal: number;
  hasSuppressed: boolean;
  statistic: ResolvedStatistic;
};

/** The abilities with a racial Modifier, counting or suppressed. */
export function listRacialAbilityScoreAdjustments(
  breakdowns: Breakdowns,
): RacialAbilityScoreAdjustment[] {
  return abilityKeys.flatMap((ability) => {
    const statistic = breakdowns[abilityTargets[ability]];
    const applied = statistic.applied.filter(
      (modifier) => modifier.bonusType === 'racial',
    );
    const hasSuppressed = statistic.suppressed.some(
      (modifier) => modifier.bonusType === 'racial',
    );
    if (applied.length === 0 && !hasSuppressed) return [];
    return [
      {
        ability,
        racialTotal: applied.reduce((sum, modifier) => sum + modifier.value, 0),
        hasSuppressed,
        statistic,
      },
    ];
  });
}

/**
 * The race's part in each ability it touches (approved prototype's traits
 * line): the racial value on its own, then the ability's total with its
 * breakdown, where base and racial stay separate lines.
 */
export function RacialAbilityScoreSummary({
  breakdowns,
}: {
  breakdowns: Breakdowns;
}) {
  const adjustments = listRacialAbilityScoreAdjustments(breakdowns);
  return (
    <div className="flex flex-col gap-1">
      <p className={fieldLabel}>{racialAbilityScoreCopy.heading}</p>
      {adjustments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {racialAbilityScoreCopy.empty}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {adjustments.map((adjustment) => (
            <li
              key={adjustment.ability}
              className="flex items-center gap-1.5 text-sm"
            >
              <span>{abilityLabels[adjustment.ability]}</span>
              <span className="text-muted-foreground font-mono text-xs">
                racial {formatModifier(adjustment.racialTotal)}
                {adjustment.hasSuppressed ? ' (part not counting)' : ''}
              </span>
              <SheetStatistic
                label={abilityLabels[adjustment.ability]}
                statistic={adjustment.statistic}
                target={abilityTargets[adjustment.ability]}
                className="text-sm"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
