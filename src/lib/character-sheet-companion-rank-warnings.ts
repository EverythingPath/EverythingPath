import type { SheetWarning } from './character-sheet';
import type { Ability } from './character-sheet-abilities';

export type CompanionWarn = (
  check: SheetWarning['check'],
  message: string,
  facts: unknown,
  kind?: SheetWarning['kind'],
) => void;

/**
 * The rank and ability-increase checks every Companion progression shares:
 * total ranks against the budget, ranks per skill against Hit Dice, and the
 * recorded increases against their count. Recorded choices are never trimmed.
 */
export function companionRankWarnings({
  creature,
  skillRanks,
  abilityIncreases,
  budgets,
  hitDice,
  warn,
}: {
  /** How the messages name the Companion, such as “Animal Companion”. */
  creature: string;
  skillRanks: Record<string, number>;
  abilityIncreases: readonly Ability[];
  budgets: { skillRanks: number | null; abilityIncreases: number | null };
  hitDice: number | null;
  warn: CompanionWarn;
}) {
  const spent = Object.values(skillRanks).reduce(
    (sum, ranks) => sum + ranks,
    0,
  );
  if (budgets.skillRanks !== null && spent > budgets.skillRanks)
    warn(
      'companionSkillRankBudget',
      `Recorded ranks exceed the ${creature}’s ${budgets.skillRanks}-rank budget.`,
      [budgets.skillRanks, skillRanks],
    );
  if (
    hitDice !== null &&
    Object.values(skillRanks).some((ranks) => ranks > hitDice)
  )
    warn(
      'companionSkillRankCap',
      `Recorded ranks exceed the ${creature}’s ${hitDice}-rank limit.`,
      [hitDice, skillRanks],
    );
  if (
    budgets.abilityIncreases !== null &&
    abilityIncreases.length !== budgets.abilityIncreases
  )
    warn(
      'companionAbilityIncreaseBudget',
      `Choose ${budgets.abilityIncreases} ${creature} ability increases; recorded choices are retained.`,
      [budgets.abilityIncreases, abilityIncreases],
    );
}
