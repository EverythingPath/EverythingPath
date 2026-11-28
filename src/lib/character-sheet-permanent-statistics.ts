import { abilityLabels, type Ability } from './character-sheet';

// #238: replacement selection uses current modifiers, bonus spells use that ability's permanent score.
export function calculateBonusSpells(
  projections: {
    current: {
      abilities: Record<Ability, { score: number; modifier: number }>;
    };
    permanent: {
      abilities: Record<Ability, { score: number; modifier: number }>;
    };
  },
  {
    baseAbility,
    replacementAbilities = [],
    spellsPerDay,
  }: {
    baseAbility: Ability;
    replacementAbilities?: readonly Ability[];
    spellsPerDay: readonly (number | null)[];
  },
) {
  const ability =
    [...new Set(replacementAbilities)].sort(
      (left, right) =>
        projections.current.abilities[right].modifier -
          projections.current.abilities[left].modifier ||
        abilityLabels[left].localeCompare(abilityLabels[right]),
    )[0] ?? baseAbility;
  const modifier = Math.floor(
    (projections.permanent.abilities[ability].score - 10) / 2,
  );
  const bonusSpells = spellsPerDay.map((entry, level) =>
    entry === null || level === 0 || level > 9 || modifier < level
      ? 0
      : 1 + Math.floor((modifier - level) / 4),
  );
  return { ability, bonusSpells };
}
