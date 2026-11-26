import { expect, test } from 'vitest';
import { eidolonBaseForms } from '~/lib/catalog/representative-eidolons';
import type { EidolonProgressionState } from '~/lib/character-sheet-eidolon-progression';
import type {
  CompanionProgressionSource,
  CompanionRuleConflict,
} from '~/lib/character-sheet-companion-sources';
import { resolveCompanionLinkedInput } from '~/lib/character-sheet-linked-inputs';
import {
  buildSheet,
  calculateFixtureSheet as calculateCharacterSheet,
} from './character-sheet-test-fixture';
import {
  buildEidolonProgressionView,
  eidolonEvolutionCatalog,
  newEidolonProgression,
  withEidolonEvolution,
  withoutEidolonEvolution,
} from './character-eidolon-progression-view-model';
import { buildCompanionProgressionView } from './character-companion-progression-view-model';
import { describeSheetUnresolved } from './character-sheet-view-helpers';

const choices: EidolonProgressionState = {
  ...newEidolonProgression('biped'),
  hpGained: 22,
  evolutions: [
    { key: 'bite' },
    { key: 'tentacle' },
    { key: 'tentacle' },
    { key: 'large' },
    { key: 'gore' },
    { key: 'scent' },
  ],
};

function fixture({
  current = 5,
  permanent = current,
}: { current?: number | null; permanent?: number | null } = {}) {
  const snapshot = buildSheet({
    levels: [],
    scores: eidolonBaseForms.biped.scores,
  });
  const input = {
    ...snapshot,
    characterKind: snapshot.character.kind,
    companionProgression: choices,
  };
  const options = (value: number | null) => ({
    companionProgressionSources: [
      { sourceKey: 'eidolon', ruleKind: 'eidolon' as const, counting: true },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
        candidates: [
          value === null
            ? {
                sourceKey: 'eidolon',
                kind: 'unavailable',
                reason: 'interrupted',
              }
            : { sourceKey: 'eidolon', kind: 'available', value },
        ],
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

test('the eidolon summary shows the pool on its supporting source, over-budget evolutions and natural attacks', () => {
  const view = buildEidolonProgressionView(fixture());
  expect(view).toMatchObject({
    baseFormName: 'Biped',
    choices,
    ordinary: {
      statusLabel: 'Active',
      summonerLevel: 5,
      actualHitDice: 4,
      classLevels: 0,
      sizeLabel: 'Large',
      pool: {
        total: 8,
        spent: 10,
        remaining: -2,
        isOverBudget: true,
        sources: [{ sourceKey: 'eidolon', sourceLabel: 'Eidolon', points: 8 }],
      },
      maxAttacks: 4,
      attackCount: 6,
      naturalAttacks: expect.arrayContaining([
        expect.objectContaining({
          name: 'Claws',
          count: 2,
          dice: '1d6',
          mediumDice: '1d4',
          missing: 2,
          roleLabel: 'Primary natural attack',
        }),
      ]),
      evolutions: expect.arrayContaining([
        expect.objectContaining({
          key: 'large',
          name: 'Large',
          costLabel: '4 points',
          issues: ['Requires summoner level 8.'],
        }),
        expect.objectContaining({ key: 'claws', costLabel: 'Base form' }),
      ]),
    },
  });
  expect(view?.ordinary.warnings.map((warning) => warning.check)).toEqual(
    expect.arrayContaining(['eidolonEvolutionPoolBudget', 'eidolonMaxAttacks']),
  );
  expect(buildCompanionProgressionView(fixture())).toBeNull();
});

test('ordinary and permanent eidolon summaries keep their own summoner levels and unresolved values', () => {
  const view = buildEidolonProgressionView(
    fixture({ current: null, permanent: 8 }),
  );
  expect(view?.ordinary).toMatchObject({
    statusLabel: 'Unresolved',
    summonerLevel: null,
    actualHitDice: null,
    pool: { total: null, remaining: null, isOverBudget: false },
  });
  expect(view?.permanent).toMatchObject({
    summonerLevel: 8,
    actualHitDice: 6,
    pool: { total: 11 },
  });
  expect(
    describeSheetUnresolved(fixture({ current: null }), {
      view: null,
    } as never).reason,
  ).toBe('Some eidolon statistics need an available summoner level.');
});

test('evolution choices come from the curated catalog and edits keep other recorded choices', () => {
  expect(
    eidolonEvolutionCatalog.find((item) => item.key === 'skilled'),
  ).toMatchObject({
    name: 'Skilled',
    cost: 1,
    choiceOptions: expect.arrayContaining([
      expect.objectContaining({ value: 'skill.per', label: 'Perception' }),
    ]),
  });
  expect(
    eidolonEvolutionCatalog.find((item) => item.key === 'large'),
  ).toMatchObject({
    cost: 4,
    minimumLevel: 8,
    upgrade: { cost: 6, label: 'Huge', minimumLevel: 13 },
  });
  const added = withEidolonEvolution(choices, {
    key: 'skilled',
    choice: 'skill.per',
  });
  expect(added.evolutions.at(-1)).toEqual({
    key: 'skilled',
    choice: 'skill.per',
  });
  expect(withoutEidolonEvolution(added, 0).evolutions).toEqual([
    ...choices.evolutions.slice(1),
    { key: 'skilled', choice: 'skill.per' },
  ]);
  expect(added.hpGained).toBe(22);
});

test('choice labels come from the catalog’s option labels', () => {
  const options = (key: string) =>
    eidolonEvolutionCatalog.find((item) => item.key === key)?.choiceOptions;
  expect(options('slam')).toEqual([
    { value: 'additional', label: 'Additional', extraCost: 0 },
    {
      value: 'replacesBaseClaws',
      label: 'Replaces the base form’s claws',
      extraCost: 0,
    },
  ]);
  expect(options('grab')).toContainEqual({
    value: 'tailSlap',
    label: 'Tail slap',
    extraCost: 0,
  });
  expect(options('abilityIncrease')).toContainEqual({
    value: 'strength',
    label: 'Strength',
    extraCost: 0,
  });
  expect(options('flight')).toContainEqual({
    value: 'magic',
    label: 'Magic',
    extraCost: 2,
  });
});

// UM p. 78: a Broodmaster eidolon reads its own divided components; its
// source is the original summoner's, not another version's.
test('a brood eidolon’s components are worded and its Broodmaster source counts as its own version', () => {
  const snapshot = buildSheet({
    levels: [],
    scores: eidolonBaseForms.biped.scores,
  });
  const state = { ...newEidolonProgression('biped'), hpGained: 6 };
  const input = {
    ...snapshot,
    characterKind: snapshot.character.kind,
    companionProgression: state,
  };
  const components = {
    hitDice: 1,
    skillRanks: 4,
    feats: 0,
    armorBonus: 1,
    strengthBonus: 0,
    dexterityBonus: 1,
    evolutionPoints: 2,
    maxAttacks: 1,
  };
  const options = {
    companionProgressionSources: [
      {
        sourceKey: 'brood',
        ruleKind: 'broodmasterEidolon' as const,
        counting: true,
        allocatedComponents: components,
      },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
        candidates: [{ sourceKey: 'brood', kind: 'available', value: 2 }],
      }),
    ],
  };
  const view = buildEidolonProgressionView({
    ...snapshot,
    entries: snapshot.entries.map((entry) =>
      entry.kind === 'base'
        ? { ...entry, state: { ...entry.state, companionProgression: state } }
        : entry,
    ),
    calculated: calculateCharacterSheet(input, options),
    permanentCalculated: calculateCharacterSheet(input, {
      ...options,
      permanentOnly: true,
    }),
  });
  expect(view?.ordinary).toMatchObject({
    actualHitDice: 1,
    bab: 2,
    contributions: [
      {
        sourceLabel: 'Eidolon brood',
        isOtherVersion: false,
        allocationSummary:
          'Hit Dice 1, skill ranks 4, feats 0, armor bonus 1, Strength bonus 0, Dexterity bonus 1, evolution points 2, maximum natural attacks 1 allocated here; the brood’s budget is unresolved.',
      },
    ],
    brood: {
      components: [
        { key: 'hitDice', label: 'Hit Dice', value: 1 },
        expect.objectContaining({ key: 'skillRanks', value: 4 }),
        expect.objectContaining({ key: 'feats', value: 0 }),
        expect.objectContaining({ key: 'armorBonus', value: 1 }),
        expect.objectContaining({ key: 'strengthBonus', value: 0 }),
        expect.objectContaining({ key: 'dexterityBonus', value: 1 }),
        expect.objectContaining({ key: 'evolutionPoints', value: 2 }),
        expect.objectContaining({ key: 'maxAttacks', value: 1 }),
      ],
      missingLabels: [],
      budgetLabel: 'The brood’s budget is unresolved',
      groupPurchases: null,
    },
  });
});

test('a large evolution the brood’s huge purchase paid for is worded as paid by the brood', () => {
  const snapshot = buildSheet({
    levels: [],
    scores: eidolonBaseForms.biped.scores,
  });
  const state: EidolonProgressionState = {
    ...newEidolonProgression('biped'),
    size: 'medium',
    hpGained: 30,
    evolutions: [{ key: 'large' }, { key: 'bite' }],
  };
  const input = {
    ...snapshot,
    characterKind: snapshot.character.kind,
    companionProgression: state,
  };
  const components = {
    hitDice: 5,
    skillRanks: 20,
    feats: 3,
    armorBonus: 6,
    strengthBonus: 2,
    dexterityBonus: 2,
    evolutionPoints: 2,
    maxAttacks: 3,
  };
  const options = {
    companionProgressionSources: [
      {
        sourceKey: 'brood',
        ruleKind: 'broodmasterEidolon' as const,
        counting: true,
        allocatedComponents: components,
        componentPool: {
          allocated: components,
          companions: 2,
          groupPurchases: ['large' as const, 'huge' as const],
        },
      },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
        candidates: [{ sourceKey: 'brood', kind: 'available', value: 13 }],
      }),
    ],
  };
  const view = buildEidolonProgressionView({
    ...snapshot,
    entries: snapshot.entries.map((entry) =>
      entry.kind === 'base'
        ? { ...entry, state: { ...entry.state, companionProgression: state } }
        : entry,
    ),
    calculated: calculateCharacterSheet(input, options),
    permanentCalculated: calculateCharacterSheet(input, {
      ...options,
      permanentOnly: true,
    }),
  });
  expect(view?.ordinary).toMatchObject({
    sizeLabel: 'Large',
    brood: {
      budgetLabel: 'From a brood of 2 eidolons',
      largestSizeLabel: 'Large',
    },
  });
  expect(
    view?.ordinary.evolutions
      .filter((row) => row.origin === 'chosen')
      .map(({ key, costLabel }) => [key, costLabel]),
  ).toEqual([
    ['large', 'Paid by the brood'],
    ['bite', '1 point'],
  ]);
});

function reducedFixture(
  sources: {
    sourceKey: string;
    ruleKind: 'eidolon' | 'masterSummonerEidolon';
    ruleConflict?: CompanionProgressionSource['ruleConflict'];
  }[],
  level: number,
) {
  const snapshot = buildSheet({
    levels: [],
    scores: eidolonBaseForms.biped.scores,
  });
  const state = { ...newEidolonProgression('biped'), hpGained: 10 };
  const input = {
    ...snapshot,
    characterKind: snapshot.character.kind,
    companionProgression: state,
  };
  const options = {
    companionProgressionSources: sources.map((source) => ({
      ...source,
      counting: true,
    })),
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
        candidates: sources.map(({ sourceKey }) => ({
          sourceKey,
          kind: 'available' as const,
          value: level,
        })),
      }),
    ],
  };
  return buildEidolonProgressionView({
    ...snapshot,
    entries: snapshot.entries.map((entry) =>
      entry.kind === 'base'
        ? { ...entry, state: { ...entry.state, companionProgression: state } }
        : entry,
    ),
    calculated: calculateCharacterSheet(input, options),
    permanentCalculated: calculateCharacterSheet(input, {
      ...options,
      permanentOnly: true,
    }),
  });
}

test('a master summoner’s eidolon words its halved level and keeps the actual summoner level apart', () => {
  const view = reducedFixture(
    [{ sourceKey: 'lesser', ruleKind: 'masterSummonerEidolon' }],
    7,
  );
  expect(view?.ordinary).toMatchObject({
    summonerLevel: 3,
    actualHitDice: 3,
    reduction: {
      label: 'Lesser Eidolon (Master Summoner)',
      summonerLevel: 7,
      tableLevel: 3,
      steps: [
        { label: 'Summoner level', value: 7 },
        { label: 'Halved, rounded down', value: 3 },
        { label: 'At least 1', value: 3 },
      ],
    },
    ruleConflict: null,
    contributions: [
      {
        sourceLabel: 'Lesser eidolon',
        valueLabel: 'Calculated',
        allocationSummary:
          'Summoner level 7, halved and rounded down to 3, at least 1: the eidolon table is read at level 3.',
      },
    ],
  });
  expect(view?.ordinary.restrictions).toContainEqual(
    expect.stringContaining('Lesser Eidolon halves the summoner level'),
  );
  const ordinary = reducedFixture(
    [{ sourceKey: 'eidolon', ruleKind: 'eidolon' }],
    7,
  );
  expect(ordinary?.ordinary).toMatchObject({
    summonerLevel: 7,
    reduction: null,
    contributions: [{ allocationSummary: null }],
  });
});

/** The sheet-level unresolved reason for one conflicting summoner source. */
function conflictUnresolvedReason(
  sourceKey: string,
  ruleConflict: CompanionRuleConflict,
) {
  const snapshot = buildSheet({
    levels: [],
    scores: eidolonBaseForms.biped.scores,
  });
  const calculated = calculateCharacterSheet(
    {
      ...snapshot,
      characterKind: snapshot.character.kind,
      companionProgression: newEidolonProgression('biped'),
    },
    {
      companionProgressionSources: [
        { sourceKey, ruleKind: 'eidolon', counting: true, ruleConflict },
      ],
      companionLinkedInputs: [
        resolveCompanionLinkedInput({
          input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
          candidates: [{ sourceKey, kind: 'available', value: 7 }],
        }),
      ],
    },
  );
  return describeSheetUnresolved({ calculated }, { view: null } as never)
    .reason;
}
const conflictReason =
  'Some eidolon statistics need one of the competing progression rules turned off.';

test('competing progression rules are named and leave the eidolon unresolved', () => {
  const ruleConflict: CompanionRuleConflict = {
    disclosure: 'disclosed',
    ruleKinds: ['broodmasterEidolon', 'masterSummonerEidolon'],
  };
  const view = reducedFixture(
    [{ sourceKey: 'class', ruleKind: 'eidolon', ruleConflict }],
    7,
  );
  expect(view?.ordinary).toMatchObject({
    statusLabel: 'Unresolved',
    summonerLevel: null,
    actualHitDice: null,
    reduction: null,
    ruleConflict: {
      labels: ['Broodmaster', 'Master Summoner'],
      summary:
        'Broodmaster and Master Summoner both change this eidolon’s progression; turn one of the Archetypes off to calculate it.',
    },
    contributions: [{ valueLabel: 'Competing rules' }],
  });
  expect(view?.ordinary.warnings.map((warning) => warning.check)).toContain(
    'companionProgressionRuleConflict',
  );
  expect(conflictUnresolvedReason('class', ruleConflict)).toBe(conflictReason);
});

test('without access to the summoner a conflict is shown unresolved with no rule named', () => {
  const ruleConflict: CompanionRuleConflict = { disclosure: 'undisclosed' };
  const view = reducedFixture(
    [{ sourceKey: 'rule:eidolon', ruleKind: 'eidolon', ruleConflict }],
    7,
  );
  expect(view?.ordinary).toMatchObject({
    statusLabel: 'Unresolved',
    summonerLevel: null,
    ruleConflict: {
      labels: [],
      summary:
        'Rules on the summoner compete to change this eidolon’s progression; it calculates once one of them is turned off.',
    },
    contributions: [{ valueLabel: 'Competing rules' }],
  });
  expect(view?.ordinary.warnings).toContainEqual(
    expect.objectContaining({
      check: 'companionProgressionRuleConflict',
      message:
        'Rules on the summoner each change how this eidolon advances from the same summoner levels, and no published rule decides between them. Every recorded choice and share is kept until one of them is turned off.',
    }),
  );
  expect(conflictUnresolvedReason('rule:eidolon', ruleConflict)).toBe(
    conflictReason,
  );
});
