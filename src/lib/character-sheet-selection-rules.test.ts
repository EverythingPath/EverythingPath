import { expect, test } from 'vitest';
import { calculateCharacterSheet } from './character-sheet';
import { representativeSelectionCatalog } from '../../convex/lib/representativeSelectionCatalog';
import {
  prerequisiteSheet,
  selectedFeat,
} from './character-sheet-prerequisite-fixture';

test('slot labels use source names, distinguish Fighter grant levels and use singular budget copy', () => {
  const input = prerequisiteSheet(
    [selectedFeat('additional')],
    [
      {
        _id: 'additional',
        name: 'Additional Traits',
        ruleIdentity: 'feat/additional',
        modifiers: [],
        detail: { kind: 'feat' },
        grantsSlots: [{ kind: 'trait', count: 2 }],
      },
      {
        _id: 'bonus',
        name: 'Fighter Bonus Feat',
        ruleIdentity: 'feature/fighter-bonus',
        modifiers: [],
        detail: { kind: 'classFeature' },
        grantsSlots: [{ kind: 'feat', count: 1, featTypes: ['combat'] }],
      },
    ],
  );
  input.entries = [
    ...input.entries,
    {
      _id: 'level-2',
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        position: 2,
        classEntryId: 'fighter',
        hpGained: 6,
      },
    },
  ];
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'fighter' && entry.detail?.kind === 'class'
      ? {
          ...entry,
          detail: {
            ...entry.detail,
            featuresByLevel: [
              { classLevel: 1, catalogEntryId: 'bonus' },
              { classLevel: 2, catalogEntryId: 'bonus' },
            ],
          },
        }
      : entry,
  );
  const result = calculateCharacterSheet(input);
  expect(
    result.selectionRules.slots
      .filter(({ grantedBy }) => grantedBy)
      .map(({ label }) => label),
  ).toEqual([
    'Additional Traits',
    'Fighter Bonus Feat (level 1)',
    'Fighter Bonus Feat (level 2)',
  ]);
  expect(result.selectionRules.budgets.bonusFeats).toBe(2);
  expect(
    result.warnings
      .filter(({ check }) => check === 'featSlotBudget')
      .map(({ message }) => message),
  ).toEqual([
    '1 fighter bonus feat (level 1) remains to select.',
    '1 fighter bonus feat (level 2) remains to select.',
  ]);
  input.entries = input.entries.filter((entry) => entry.kind !== 'feat');
  expect(
    calculateCharacterSheet(input).warnings.find(
      ({ subject }) => subject === 'feat:general',
    )?.message,
  ).toBe('1 general feat remains to select.');
});

test('feat slots count the first HD once, bonus slots separately and incompatible types as advisories', () => {
  const input = prerequisiteSheet(
    [selectedFeat('plain'), selectedFeat('wrong')],
    [
      {
        _id: 'plain',
        ruleIdentity: 'feat/plain',
        modifiers: [],
        detail: { kind: 'feat', featTypes: ['general'], repeatable: 'no' },
      },
      {
        _id: 'wrong',
        ruleIdentity: 'feat/wrong',
        modifiers: [],
        detail: { kind: 'feat', featTypes: ['general'], repeatable: 'no' },
      },
    ],
  );
  input.catalogEntries = input.catalogEntries.map((definition) =>
    definition._id === 'fighter'
      ? {
          ...definition,
          grantsSlots: [{ kind: 'feat', count: 1, featTypes: ['combat'] }],
        }
      : definition,
  );
  input.entries = input.entries.map((entry) =>
    entry._id === 'wrong' && entry.kind === 'feat'
      ? {
          ...entry,
          selectionSource: {
            kind: 'slot',
            grantedBy: { kind: 'entry', entryId: 'level-1' },
          },
          state: {
            ...entry.state,
            slot: { grantedBy: { kind: 'entry', entryId: 'level-1' } },
          },
        }
      : entry,
  );
  const result = calculateCharacterSheet(input);
  expect(result.selectionRules.budgets).toMatchObject({
    generalFeats: 1,
    bonusFeats: 1,
    traits: 2,
    drawbacks: 1,
  });
  expect(
    result.selectionRules.slots
      .filter(({ kind }) => kind === 'feat')
      .map(({ count, used }) => [count, used]),
  ).toEqual([
    [1, 1],
    [1, 1],
  ]);
  expect(result.warnings.some(({ check }) => check === 'featSlotType')).toBe(
    true,
  );
});

test('trait budgets, drawback limits, repeatability and NPC/campaign restrictions stay advisory', () => {
  const input = prerequisiteSheet(
    [
      selectedFeat('additional'),
      selectedFeat('focus'),
      {
        ...selectedFeat('focus-copy'),
        state: { kind: 'feat', choice: ' LONGSWORD ' },
      },
      ...['combat-a', 'combat-b', 'drawback-a', 'drawback-b'].map((id) => ({
        _id: id,
        catalogEntryId: id,
        kind: 'trait' as const,
        active: true,
        state: { kind: 'trait' as const },
      })),
    ],
    [
      {
        _id: 'additional',
        ruleIdentity: 'feat/additional',
        modifiers: [],
        detail: { kind: 'feat', additionalTraits: true, repeatable: 'yes' },
        grantsSlots: [{ kind: 'trait', count: 2 }],
      },
      {
        _id: 'focus',
        ruleIdentity: 'feat/focus',
        modifiers: [],
        detail: { kind: 'feat', repeatable: 'newChoice' },
      },
      {
        _id: 'focus-copy',
        ruleIdentity: 'feat/focus',
        modifiers: [],
        detail: { kind: 'feat', repeatable: 'newChoice' },
      },
      ...['combat-a', 'combat-b', 'drawback-a', 'drawback-b'].map((id) => ({
        _id: id,
        ruleIdentity: `trait/${id}`,
        modifiers: [],
        detail: {
          kind: 'trait' as const,
          traitType: id.startsWith('combat') ? 'combat' : 'drawback',
        },
      })),
    ],
  );
  input.characterKind = 'npc';
  input.entries = input.entries.map((entry) =>
    entry.kind === 'base'
      ? { ...entry, state: { ...entry.state, campaignTraitRequired: true } }
      : entry._id === 'focus' && entry.kind === 'feat'
        ? { ...entry, state: { kind: 'feat', choice: 'longsword' } }
        : entry,
  );
  const result = calculateCharacterSheet(input);
  expect(result.selectionRules.budgets.traits).toBe(5);
  expect(
    result.warnings
      .filter(({ check }) =>
        [
          'traitType',
          'drawbackCount',
          'campaignTraitRequired',
          'featDuplicate',
        ].includes(check),
      )
      .map(({ check }) => check),
  ).toEqual([
    'drawbackCount',
    'traitType',
    'traitType',
    'campaignTraitRequired',
    'featDuplicate',
  ]);
  expect(result.warnings.some(({ check }) => check === 'npcTraits')).toBe(
    false,
  );
  input.catalogEntries = input.catalogEntries.map((definition) =>
    definition._id === 'additional'
      ? { ...definition, detail: { kind: 'feat' } }
      : definition,
  );
  expect(
    calculateCharacterSheet(input).warnings.some(
      ({ check }) => check === 'npcTraits',
    ),
  ).toBe(true);
});

test('saved slot positions and drawback bucket mismatches warn without removing selections', () => {
  const input = prerequisiteSheet(
    [
      {
        ...selectedFeat('feat'),
        selectionSlot: { id: 'feat:general', position: 3 },
      },
      {
        _id: 'drawback',
        kind: 'trait',
        catalogEntryId: 'drawback',
        active: true,
        selectionSlot: { id: 'trait:general', position: 0 },
        state: { kind: 'trait' },
      },
      {
        _id: 'trait',
        kind: 'trait',
        catalogEntryId: 'trait',
        active: true,
        selectionSlot: { id: 'trait:drawback', position: 0 },
        state: { kind: 'trait' },
      },
    ],
    [
      {
        _id: 'feat',
        ruleIdentity: 'feat/feat',
        modifiers: [],
        detail: { kind: 'feat' },
      },
      {
        _id: 'drawback',
        ruleIdentity: 'trait/drawback',
        modifiers: [],
        detail: { kind: 'trait', traitType: 'drawback' },
      },
      {
        _id: 'trait',
        ruleIdentity: 'trait/trait',
        modifiers: [],
        detail: { kind: 'trait', traitType: 'combat' },
      },
    ],
  );
  const result = calculateCharacterSheet(input);
  expect(
    result.warnings.filter(({ check }) => check === 'traitSlotType'),
  ).toHaveLength(2);
  expect(
    result.warnings.some(
      ({ check, target }) =>
        check === 'featSlotBudget' &&
        target.kind === 'entry' &&
        target.entryId === 'feat',
    ),
  ).toBe(true);
  expect(
    result.resolvedEntries.filter(({ counting }) => counting),
  ).toHaveLength(3);
});

test('class alignment rules warn against current alignment without blocking advancement', () => {
  const input = prerequisiteSheet();
  input.entries = input.entries.map((entry) =>
    entry.kind === 'base'
      ? { ...entry, state: { ...entry.state, alignment: 'CE' } }
      : entry,
  );
  input.catalogEntries = input.catalogEntries.map((definition) =>
    definition._id === 'fighter' && definition.detail?.kind === 'class'
      ? { ...definition, detail: { ...definition.detail, alignments: ['LG'] } }
      : definition,
  );
  expect(
    calculateCharacterSheet(input).warnings.filter(
      ({ check }) => check === 'classAlignment',
    ),
  ).toHaveLength(1);
  expect(calculateCharacterSheet(input).level).toBe(1);
});

test('nonrepeatable and trait duplicates use durable identity while repeatable feats permit copies', () => {
  const input = prerequisiteSheet(
    [
      selectedFeat('once'),
      selectedFeat('once-copy'),
      selectedFeat('many'),
      selectedFeat('many-copy'),
      {
        _id: 'trait',
        kind: 'trait',
        catalogEntryId: 'trait',
        active: true,
        state: { kind: 'trait' },
      },
      {
        _id: 'trait-copy',
        kind: 'trait',
        catalogEntryId: 'trait-copy',
        active: true,
        state: { kind: 'trait' },
      },
    ],
    [
      {
        _id: 'once',
        ruleIdentity: 'feat/once',
        modifiers: [],
        detail: { kind: 'feat', repeatable: 'no' },
      },
      {
        _id: 'once-copy',
        name: 'Renamed copy',
        ruleIdentity: 'feat/once',
        modifiers: [],
        detail: { kind: 'feat', repeatable: 'no' },
      },
      {
        _id: 'many',
        ruleIdentity: 'feat/many',
        modifiers: [],
        detail: { kind: 'feat', repeatable: 'yes' },
      },
      {
        _id: 'many-copy',
        ruleIdentity: 'feat/many',
        modifiers: [],
        detail: { kind: 'feat', repeatable: 'yes' },
      },
      {
        _id: 'trait',
        ruleIdentity: 'trait/same',
        modifiers: [],
        detail: { kind: 'trait', traitType: 'combat' },
      },
      {
        _id: 'trait-copy',
        ruleIdentity: 'trait/same',
        modifiers: [],
        detail: { kind: 'trait', traitType: 'combat' },
      },
    ],
  );
  const warnings = calculateCharacterSheet(input).warnings;
  expect(
    warnings
      .filter(({ check }) => check === 'featDuplicate')
      .map(({ subject }) => subject),
  ).toEqual(['once-copy']);
  expect(
    warnings
      .filter(({ check }) => check === 'traitDuplicate')
      .map(({ subject }) => subject),
  ).toEqual(['trait-copy']);
});

test('two seeded Skill Focus feats on the same skill warn, on different skills do not', () => {
  const skillFocus = representativeSelectionCatalog.find(
    (definition) => definition.ruleIdentity === 'skill-focus',
  );
  if (!skillFocus) throw new Error('Skill Focus is not seeded');
  const choose = (id: string, choice: string, order: number) => {
    const entry = { ...selectedFeat(id, order), catalogEntryId: 'skill-focus' };
    return { ...entry, state: { ...entry.state, choice } };
  };
  const duplicates = (choices: string[]) =>
    calculateCharacterSheet(
      prerequisiteSheet(
        choices.map((choice, order) => choose(`focus-${order}`, choice, order)),
        [{ ...skillFocus, _id: 'skill-focus' }],
      ),
    )
      .warnings.filter(({ check }) => check === 'featDuplicate')
      .map(({ subject }) => subject);

  expect(duplicates(['Perception', 'Perception'])).toEqual(['focus-1']);
  expect(duplicates(['Perception', 'Stealth'])).toEqual([]);
});
