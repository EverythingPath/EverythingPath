import {
  alternativeAnimalCompanionAdvancement,
  representativeAnimalCompanions,
} from '~/lib/catalog/representative-animal-companions';
import { abilityLabels, type Ability } from '~/lib/character-sheet';
import type { AnimalCompanionProgressionState } from '~/lib/character-sheet-companion-progression';
import type { CreatureSize } from '~/lib/character-sheet-creature-sizes';
import { formatModifier } from './sheet-parts';

export const creatureSizeLabels: Record<CreatureSize, string> = {
  fine: 'Fine',
  diminutive: 'Diminutive',
  tiny: 'Tiny',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  huge: 'Huge',
  gargantuan: 'Gargantuan',
  colossal: 'Colossal',
};

/** "Strength +8, Dexterity -2": each non-zero ability change, in words. */
function describeAbilityChanges(scores: Partial<Record<Ability, number>>) {
  return Object.entries(scores)
    .filter(([, value]) => value !== 0)
    .map(([ability, value]) =>
      // Safe cast: scores is keyed by Ability, so its entries' keys are
      // abilities.
      `${abilityLabels[ability as Ability]} ${formatModifier(value)}`,
    );
}

/** The published species advancement in words, from the curated species. */
export function describeSpeciesAdvancement(
  species: AnimalCompanionProgressionState['species'],
) {
  const { size, advancement } = representativeAnimalCompanions[species];
  return [
    ...(advancement.size !== size
      ? [`Size ${creatureSizeLabels[advancement.size]}`]
      : []),
    ...describeAbilityChanges(advancement.scores),
    ...(advancement.naturalArmor
      ? [`natural armor ${formatModifier(advancement.naturalArmor)}`]
      : []),
  ].join(', ');
}

/** "Dexterity and Constitution instead": the alternative's abilities. */
export const alternativeAdvancementTitle = `${Object.keys(
  alternativeAnimalCompanionAdvancement,
)
  // Safe cast: the alternative advancement is keyed by Ability.
  .map((ability) => abilityLabels[ability as Ability])
  .join(' and ')} instead`;
