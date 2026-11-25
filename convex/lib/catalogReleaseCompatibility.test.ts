// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { calculateActiveCharacterSheet } from './catalogReleaseCompatibility';
import { abilityKeys, abilityTargets } from '../../src/lib/character-sheet';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';

test('active sheet calculations produce current and permanent projections from explicit sheet inputs', () => {
  const projections = calculateActiveCharacterSheet(
    {
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
          _id: 'damage',
          kind: 'abilityDamage',
          active: true,
          state: { kind: 'abilityDamage', ability: 'strength', points: 2 },
        },
      ],
      catalogEntries: [
        {
          _id: 'base',
          ruleIdentity: 'base',
          modifiers: abilityKeys.map((ability) => ({
            target: abilityTargets[ability],
            bonusType: 'base',
            value: 15,
          })),
        },
      ],
    },
    catalogRuntimeCompatibility.calculation,
  );

  expect(projections).toMatchObject({
    current: { level: 0, abilities: { strength: { score: 15, modifier: 1 } } },
    permanent: {
      level: 0,
      abilities: { strength: { score: 15, modifier: 2 } },
    },
  });
});
