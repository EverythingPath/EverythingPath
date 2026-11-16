import { expect, test } from 'vitest';
import type { AnimalCompanionProgressionState } from '~/lib/character-sheet-companion-progression';
import { resolveCompanionLinkedInput } from '~/lib/character-sheet-linked-inputs';
import { representativeAnimalCompanions } from '~/lib/catalog/representative-animal-companions';
import {
  buildSheet,
  calculateFixtureSheet as calculateCharacterSheet,
} from './character-sheet-test-fixture';
import { buildCompanionProgressionView } from './character-companion-progression-view-model';

const choices: AnimalCompanionProgressionState = {
  species: 'wolf',
  hpGained: 27,
  skillRanks: { per: 6 },
  abilityIncreases: ['strength'],
  advancementChoice: 'species',
  keep: false,
};

function fixture({
  current = 7,
  permanent = current,
  fallback,
  counting = true,
}: {
  current?: number | null;
  permanent?: number | null;
  fallback?: number;
  counting?: boolean;
} = {}) {
  const snapshot = buildSheet({
    levels: [],
    scores: representativeAnimalCompanions.wolf.scores,
  });
  const input = {
    ...snapshot,
    characterKind: snapshot.character.kind,
    companionProgression: choices,
  };
  const options = (value: number | null) => ({
    companionProgressionSources: [
      {
        sourceKey: 'nature-bond',
        ruleKind: 'druidCompanion' as const,
        counting,
      },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'druid' },
        candidates: [
          value === null
            ? {
                sourceKey: 'nature-bond',
                kind: 'unavailable',
                reason: 'interrupted',
              }
            : { sourceKey: 'nature-bond', kind: 'available', value },
        ],
        fallback,
      }),
    ],
  });
  return {
    ...snapshot,
    entries: snapshot.entries.map((entry) =>
      entry.kind === 'base'
        ? { ...entry, state: { ...entry.state, companionProgression: choices } }
        : entry,
    ),
    calculated: calculateCharacterSheet(input, options(current)),
    permanentCalculated: calculateCharacterSheet(input, {
      ...options(permanent),
      permanentOnly: true,
    }),
  };
}

test('the Companion sheet summary distinguishes actual Hit Dice, Class Levels and source-backed progression budgets', () => {
  const view = buildCompanionProgressionView(fixture());
  expect(view).toMatchObject({
    speciesName: 'Wolf',
    choices,
    ordinary: {
      classLevels: 0,
      actualHitDice: 6,
      effectiveLevel: 7,
      statusLabel: 'Active',
      sizeLabel: 'Large',
      budgets: { generalFeats: 3, skillRanks: 6, abilityIncreases: 1 },
      advancement: { level: 7, applied: true, choice: 'species' },
      contributions: [
        {
          classRuleIdentity: 'druid',
          classLevels: 7,
          effectiveLevel: 7,
          valueLabel: 'Calculated',
        },
      ],
    },
    permanent: { classLevels: 0, actualHitDice: 6, effectiveLevel: 7 },
  });
  expect(view?.ordinary.sources[0]).toMatchObject({
    book: 'Pathfinder RPG Core Rulebook',
  });
});

test('current and permanent summaries preserve distinct linked progression and retain choices when advancement shrinks', () => {
  const view = buildCompanionProgressionView(
    fixture({ current: 7, permanent: 3 }),
  );
  expect(view?.ordinary).toMatchObject({
    effectiveLevel: 7,
    actualHitDice: 6,
    advancement: { applied: true },
  });
  expect(view?.permanent).toMatchObject({
    effectiveLevel: 3,
    actualHitDice: 3,
    advancement: { applied: false },
  });
  expect(view?.choices).toEqual(choices);
  expect(view?.permanent.warnings.map((warning) => warning.check)).toContain(
    'companionSkillRankBudget',
  );
});

test('the sheet distinguishes applied fallbacks from unresolved advancement and restoration suspends saved fallbacks', () => {
  const unresolved = buildCompanionProgressionView(fixture({ current: null }));
  expect(unresolved?.ordinary).toMatchObject({
    statusLabel: 'Unresolved',
    effectiveLevel: null,
    actualHitDice: null,
  });
  expect(unresolved?.ordinary.contributions[0]?.valueLabel).toBe('Unresolved');
  const fallback = buildCompanionProgressionView(
    fixture({ current: null, fallback: 7 }),
  );
  expect(fallback?.ordinary).toMatchObject({
    effectiveLevel: 7,
    actualHitDice: 6,
  });
  expect(fallback?.ordinary.contributions[0]).toMatchObject({
    valueLabel: 'Using saved fallback',
    hasSavedFallback: true,
    fallbackState: 'applied',
  });
  const restored = buildCompanionProgressionView(
    fixture({ current: 3, fallback: 7 }),
  );
  expect(restored?.ordinary).toMatchObject({
    effectiveLevel: 3,
    actualHitDice: 3,
  });
  expect(restored?.ordinary.contributions[0]).toMatchObject({
    valueLabel: 'Calculated',
    hasSavedFallback: true,
    fallbackState: 'suspended',
  });
  expect(restored?.choices).toEqual(choices);
});

test('lost sources remain visible without counting or deleting the Companion’s recorded choices', () => {
  const view = buildCompanionProgressionView(fixture({ counting: false }));
  expect(view?.ordinary).toMatchObject({
    statusLabel: 'Not counting now',
    actualHitDice: null,
  });
  expect(view?.ordinary.contributions[0]).toMatchObject({
    counting: false,
    valueLabel: 'Not contributing',
  });
  expect(view?.choices).toEqual(choices);
});
