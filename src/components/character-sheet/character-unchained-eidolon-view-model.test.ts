import { expect, test } from 'vitest';
import { eidolonBaseForms } from '~/lib/catalog/representative-eidolons';
import type { EidolonProgressionState } from '~/lib/character-sheet-eidolon-progression';
import { resolveCompanionLinkedInput } from '~/lib/character-sheet-linked-inputs';
import {
  buildSheet,
  calculateFixtureSheet as calculateCharacterSheet,
} from './character-sheet-test-fixture';
import {
  buildEidolonProgressionView,
  eidolonEvolutionCatalogFor,
  newEidolonProgression,
  unchainedEidolonSubtypeChoices,
  withEidolonSubtype,
  withEidolonSubtypeChoice,
  withEidolonVersion,
  withoutEidolonDormantChoice,
} from './character-eidolon-progression-view-model';
import { describeSheetUnresolved } from './character-sheet-view-helpers';

const angel: EidolonProgressionState = {
  ...withEidolonSubtype(newEidolonProgression('biped', 'unchained'), 'angel'),
  hpGained: 30,
  evolutions: [{ key: 'bite' }],
};

function fixture(
  choices: EidolonProgressionState,
  ruleKind: 'eidolon' | 'unchainedEidolon' = 'unchainedEidolon',
  level = 8,
) {
  const snapshot = buildSheet({
    levels: [],
    scores: eidolonBaseForms.biped.scores,
  });
  const input = {
    ...snapshot,
    characterKind: snapshot.character.kind,
    companionProgression: choices,
  };
  const options = {
    companionProgressionSources: [
      { sourceKey: 'eidolon', ruleKind, counting: true },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
        candidates: [{ sourceKey: 'eidolon', kind: 'available', value: level }],
      }),
    ],
  };
  return {
    ...snapshot,
    entries: snapshot.entries.map((entry) =>
      entry.kind === 'base'
        ? { ...entry, state: { ...entry.state, companionProgression: choices } }
        : entry,
    ),
    calculated: calculateCharacterSheet(input, options),
    permanentCalculated: calculateCharacterSheet(input, {
      ...options,
      permanentOnly: true,
    }),
  };
}

test('a new Unchained eidolon records its version, and subtype and version changes keep every other choice', () => {
  expect(newEidolonProgression('serpentine', 'unchained')).toMatchObject({
    kind: 'eidolon',
    version: 'unchained',
    baseForm: 'serpentine',
    subtypeChoices: [],
    evolutions: [],
  });
  expect(newEidolonProgression('biped')).not.toHaveProperty('version');
  const archon = withEidolonSubtypeChoice(
    withEidolonSubtype(angel, 'archon'),
    'archon-abilityIncrease-8',
    'wisdom',
  );
  expect(archon).toMatchObject({
    subtype: 'archon',
    subtypeChoices: [{ key: 'archon-abilityIncrease-8', choice: 'wisdom' }],
    evolutions: angel.evolutions,
  });
  expect(
    withEidolonSubtypeChoice(archon, 'archon-abilityIncrease-8', 'charisma')
      .subtypeChoices,
  ).toEqual([{ key: 'archon-abilityIncrease-8', choice: 'charisma' }]);
  expect(withEidolonVersion(archon, 'original')).toEqual({
    ...archon,
    version: 'original',
  });
});

test('discarding a dormant entry removes only that subtype choice or the subtype itself', () => {
  const recorded: EidolonProgressionState = {
    ...withEidolonVersion(angel, 'original'),
    subtypeChoices: [
      { key: 'archon-abilityIncrease-8', choice: 'wisdom' },
      { key: 'demon-abilityIncrease-12', choice: 'strength' },
    ],
  };
  expect(
    withoutEidolonDormantChoice(recorded, {
      kind: 'subtypeChoice',
      key: 'archon-abilityIncrease-8',
    }),
  ).toEqual({
    ...recorded,
    subtypeChoices: [{ key: 'demon-abilityIncrease-12', choice: 'strength' }],
  });
  const { subtype: _subtype, ...withoutSubtype } = recorded;
  expect(
    withoutEidolonDormantChoice(recorded, { kind: 'subtype', key: 'angel' }),
  ).toEqual(withoutSubtype);
});

test('the subtype choices and per-version evolution lists come from the curated catalog', () => {
  expect(
    unchainedEidolonSubtypeChoices.find(({ value }) => value === 'protean'),
  ).toMatchObject({
    label: 'Protean',
    alignment: 'Chaotic neutral',
    baseForms: [
      {
        value: 'serpentine',
        label: 'Serpentine',
        freeEvolutions: ['Bite', 'Grab (Tail slap)', 'Tail', 'Tail Slap'],
      },
    ],
    evolutionsByLevel: expect.arrayContaining([
      { level: 1, names: ['Resistance (Acid)', 'Grab'] },
    ]),
    choices: [
      expect.objectContaining({ key: 'protean-grab-1', label: 'Grab attack' }),
    ],
  });
  const unchained = eidolonEvolutionCatalogFor('unchained');
  expect(unchained.find(({ key }) => key === 'pounce')).toMatchObject({
    cost: 3,
    minimumLevel: 7,
  });
  expect(unchained.find(({ key }) => key === 'bite')?.subtypes).toEqual([
    'Agathion',
    'Daemon',
    'Demon',
    'Devil',
    'Div',
    'Elemental',
    'Protean',
    'Psychopomp',
  ]);
  expect(
    eidolonEvolutionCatalogFor('unchained').find(
      ({ key }) => key === 'damageReduction',
    ),
  ).toMatchObject({ choiceOptions: [], upgrade: null });
  expect(
    eidolonEvolutionCatalogFor('original').find(({ key }) => key === 'bite')
      ?.subtypes,
  ).toBeNull();
});

test('the Unchained summary labels fixed subtype evolutions, subtype requirements and the subtype', () => {
  const view = buildEidolonProgressionView(fixture(angel));
  expect(view).toMatchObject({
    subtypeName: 'Angel',
    ordinary: {
      version: 'unchained',
      versionLabel: 'Unchained',
      versionMismatch: false,
      subtype: { name: 'Angel', alignment: 'Any good', missingChoices: [] },
      pool: { total: 6, bonuses: [] },
    },
  });
  expect(
    view?.ordinary.evolutions.map(({ name, costLabel, isFixed }) => [
      name,
      costLabel,
      isFixed,
    ]),
  ).toEqual([
    ['Limbs', 'Base form', true],
    ['Limbs', 'Base form', true],
    ['Slam', 'Base form', true],
    ['Resistance', 'Angel subtype, 1st level', true],
    ['Resistance', 'Angel subtype, 1st level', true],
    ['Flight', 'Angel subtype, 8th level', true],
    ['Bite', '1 point', false],
  ]);
});

test('summoner levels of the other version and dormant choices are named in the view', () => {
  const recorded = {
    ...withEidolonSubtypeChoice(angel, 'archon-abilityIncrease-8', 'wisdom'),
    evolutions: [{ key: 'damageReduction' as const, choice: 'evil' }],
  };
  const mixed = fixture(recorded, 'eidolon');
  const view = buildEidolonProgressionView(mixed);
  expect(view?.ordinary).toMatchObject({
    status: 'unresolved',
    versionMismatch: true,
    contributions: [
      expect.objectContaining({
        isOtherVersion: true,
        sourceLabel: 'Eidolon',
        valueLabel: 'Original summoner levels',
      }),
    ],
    dormantChoices: [
      {
        label: 'Archon: Ability Increase (8th level)',
        choice: 'Wisdom',
        reasonLabel: 'Belongs to another subtype',
      },
    ],
  });
  expect(
    view?.ordinary.evolutions.find(({ key }) => key === 'damageReduction'),
  ).toMatchObject({ dormantLabel: 'Choice not part of the Unchained rules' });
  expect(describeSheetUnresolved(mixed, { view: null } as never).reason).toBe(
    'Some eidolon statistics need summoner levels of the eidolon’s own version.',
  );
});
