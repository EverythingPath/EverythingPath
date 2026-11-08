import {
  abilityKeys,
  abilityTargets,
  type CharacterSheetInput,
} from '../../../src/lib/character-sheet';
import { findRacialProgression } from '../../../src/lib/character-sheet-creature-types';

// A custom race demonstrates the seed contract; it is not imported/admitted
// racial-hd content. The source-bound catalog test verifies these seed values.
export function racialHdSheet(creatureType: string): CharacterSheetInput {
  const progression = findRacialProgression(creatureType);
  if (!progression)
    throw new Error(`Missing creature-type seed: ${creatureType}`);
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      {
        _id: 'race-row',
        kind: 'race',
        active: true,
        catalogEntryId: 'custom-race',
        state: {
          kind: 'race',
          racialHpGained: 7,
          racialSkillRanks: { per: 1 },
        },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'fixture-base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 10,
        })),
      },
      {
        _id: 'custom-race',
        ruleIdentity: 'fixture-custom-race',
        modifiers: [],
        detail: {
          kind: 'race',
          racialTraits: [],
          racialHitDice: 3,
          racialProgression: progression,
        },
      },
    ],
  };
}
