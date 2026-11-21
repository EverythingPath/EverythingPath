import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetInput,
  type ResolvedStatistic,
} from '~/lib/character-sheet';
import { buildSheet } from './character-sheet-test-fixture';
import {
  buildSituationBreakdownView,
  findEntrySituationNotes,
  listCharacterSituationGroups,
} from './situations-view-model';

test('Point-Blank Shot uses a readable shared Situation label and previews the ranged bonus', () => {
  const snapshot = buildSheet({
    adjustments: [
      {
        id: 'point-blank',
        name: 'Point-Blank Shot',
        modifiers: [
          {
            target: 'attack.ranged',
            bonusType: 'untyped',
            value: 1,
            condition: { situation: 'within30ft' },
          },
        ],
      },
    ],
  });
  const view = buildSituationBreakdownView({
    ordinary: snapshot.calculated.breakdowns['attack.ranged'],
    target: 'attack.ranged',
    previewSituation: (situations) =>
      calculateCharacterSheet(
        { ...snapshot, characterKind: 'pc' },
        { situations },
      ),
  });
  expect(view.groups).toMatchObject([
    { text: 'within 30 ft.', statistic: { total: 1 } },
  ]);
  expect(view.hasMarker).toBe(true);
  expect(snapshot.calculated.breakdowns['attack.ranged'].total).toBe(0);
});

test('explicit Situation combinations recompute stacking rather than adding alternate bonuses', () => {
  const snapshot = buildSheet({
    adjustments: [
      {
        id: 'rage',
        name: 'Rage',
        modifiers: [{ target: 'save.will', bonusType: 'morale', value: 2 }],
      },
      {
        id: 'superstition',
        name: 'Superstition',
        modifiers: [
          {
            target: 'save.will',
            bonusType: 'morale',
            value: 3,
            condition: { situation: 'spells' },
          },
        ],
      },
      {
        id: 'fearless',
        name: 'Fearless',
        modifiers: [
          {
            target: 'save.will',
            bonusType: 'racial',
            value: 2,
            condition: { situation: 'fear' },
          },
        ],
      },
    ],
  });
  const view = buildSituationBreakdownView({
    ordinary: snapshot.calculated.breakdowns['save.will'],
    target: 'save.will',
    selected: ['spells', 'fear'],
    previewSituation: (situations) =>
      calculateCharacterSheet(
        { ...snapshot, characterKind: 'pc' },
        { situations },
      ),
  });
  expect(view.selected?.statistic.total).toBe(5);
  expect(
    view.groups.map((group) => [group.text, group.statistic?.total]),
  ).toEqual([
    ['vs. spells', 3],
    ['vs. fear', 4],
  ]);
  expect(view.selected?.statistic.suppressed).toEqual(
    expect.arrayContaining([expect.objectContaining({ entryName: 'Rage' })]),
  );
  expect(snapshot.calculated.breakdowns['save.will'].total).toBe(2);
});

test('a scoped-out bonus is separate from a selected Situation waiting on its inactive prerequisite', () => {
  const snapshot = buildSheet({
    adjustments: [
      {
        id: 'waiting',
        name: 'Superstition',
        modifiers: [
          {
            target: 'save.will',
            bonusType: 'morale',
            value: 3,
            condition: { situation: 'spells', whileActive: 'rage' },
          },
        ],
      },
      {
        id: 'other-scope',
        name: 'School bonus',
        modifiers: [
          {
            target: 'save.will',
            bonusType: 'untyped',
            value: 20,
            condition: { situation: 'spells', school: 'evocation' },
          },
        ],
      },
    ],
  });
  const view = buildSituationBreakdownView({
    ordinary: snapshot.calculated.breakdowns['save.will'],
    target: 'save.will',
    selected: ['spells'],
    previewSituation: (situations) =>
      calculateCharacterSheet(
        { ...snapshot, characterKind: 'pc' },
        { situations },
      ),
  });
  expect(view.selected?.waiting.map((row) => row.entryName)).toEqual([
    'Superstition',
  ]);
  expect(view.excluded.map((row) => row.entryName)).toEqual(['School bonus']);
  expect(view.groups[0]?.change?.total).toBeNull();
  expect(view.selected?.statistic.total).toBe(0);
});

test('notes explain their own Situation without inventing a total and untargeted notes remain entry-local', () => {
  const snapshot = buildSheet();
  const ordinary = {
    ...snapshot.calculated.breakdowns['save.will'],
    notes: [
      {
        target: 'save.will',
        situation: 'fear',
        text: 'Reroll a failed save.',
        sheetEntryId: 'fearless',
        entryName: 'Fearless',
        source: 'fearless',
        builtIn: false,
      },
    ],
  } satisfies ResolvedStatistic;
  const view = buildSituationBreakdownView({
    ordinary,
    target: 'save.will',
    selected: ['fear'],
    previewSituation: () => ({
      ...snapshot.calculated,
      breakdowns: { ...snapshot.calculated.breakdowns, 'save.will': ordinary },
    }),
  });
  expect(view.hasMarker).toBe(true);
  expect(view.groups[0]?.notes.map((note) => note.text)).toEqual([
    'Reroll a failed save.',
  ]);
  expect(view.groups[0]?.change?.total).toBeNull();
  expect(view.selected?.statistic.total).toBe(0);
  expect(
    findEntrySituationNotes(
      [
        {
          text: 'Confirm automatically.',
          sheetEntryId: 'critical-focus',
          entryName: 'Critical Focus',
          source: 'critical-focus',
          builtIn: false,
        },
        ...ordinary.notes,
      ],
      'critical-focus',
    ).map((note) => note.text),
  ).toEqual(['Confirm automatically.']);
});

test('sheet-wide picker retains identical local wording as separate entry choices', () => {
  const snapshot = buildSheet({
    adjustments: [
      {
        id: 'first',
        name: 'First',
        modifiers: [
          {
            target: 'save.will',
            bonusType: 'racial',
            value: 2,
            condition: { situation: { local: 'in darkness' } },
          },
        ],
      },
      {
        id: 'second',
        name: 'Second',
        modifiers: [
          {
            target: 'save.will',
            bonusType: 'racial',
            value: 4,
            condition: { situation: { local: 'in darkness' } },
          },
        ],
      },
    ],
  });
  const groups = listCharacterSituationGroups(snapshot.calculated);
  expect(groups).toHaveLength(2);
  expect(groups.map((group) => group.entryName)).toEqual(['First', 'Second']);
  expect(new Set(groups.map((group) => group.key)).size).toBe(2);
  const view = buildSituationBreakdownView({
    ordinary: snapshot.calculated.breakdowns['save.will'],
    target: 'save.will',
    selected: [{ local: 'in darkness', sheetEntryId: 'first' }],
    previewSituation: (situations) =>
      calculateCharacterSheet(
        { ...snapshot, characterKind: 'pc' },
        { situations },
      ),
  });
  expect(view.selected?.statistic.total).toBe(2);
});

test.each([
  ['spells', 'spellLikeAbilities'],
  ['charm', 'enchantment'],
  ['flanking', 'melee'],
])(
  'selecting %s does not imply %s in a number explanation',
  (selected, unselected) => {
    const snapshot = buildSheet({
      adjustments: [
        {
          id: 'picked',
          name: 'Picked',
          modifiers: [
            {
              target: 'save.will',
              bonusType: 'racial',
              value: 2,
              condition: { situation: selected },
            },
          ],
        },
        {
          id: 'other',
          name: 'Other',
          modifiers: [
            {
              target: 'save.will',
              bonusType: 'racial',
              value: 8,
              condition: { situation: unselected },
            },
          ],
        },
      ],
    });
    const view = buildSituationBreakdownView({
      ordinary: snapshot.calculated.breakdowns['save.will'],
      target: 'save.will',
      selected: [selected],
      previewSituation: (situations) =>
        calculateCharacterSheet(
          { ...snapshot, characterKind: 'pc' },
          { situations },
        ),
    });
    expect(view.selected?.statistic.total).toBe(2);
    expect(
      view.selected?.statistic.applied.map((item) => item.entryName),
    ).toContain('Picked');
    expect(
      view.selected?.statistic.applied.map((item) => item.entryName),
    ).not.toContain('Other');
    expect(view.selected?.waiting).toEqual([]);
    expect(
      view.groups.find((group) => group.selection === unselected)?.change
        ?.total,
    ).toBe(8);
  },
);

// Huntsman (#764): its die waits on a local Situation of the weapon carrying
// it, so the picker offers it as that weapon's own choice.
test("a local-Situation die is offered as its weapon's own Situation", () => {
  const tracked =
    'against a creature the wielder has tracked with Survival in the past day';
  const input: CharacterSheetInput = {
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
        _id: 'sword',
        kind: 'item',
        active: true,
        catalogEntryId: 'longsword',
        state: {
          kind: 'item',
          enhancement: 1,
          abilities: [{ catalogEntryId: 'huntsman' }],
        },
      },
      {
        _id: 'routine',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Sword',
          weaponEntryId: 'sword',
          hands: 'one',
          mode: 'melee',
        },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((key) => ({
          target: abilityTargets[key],
          bonusType: 'base' as const,
          value: 10,
        })),
      },
      {
        _id: 'longsword',
        name: 'Longsword',
        ruleIdentity: 'longsword',
        modifiers: [],
        detail: {
          kind: 'item',
          weapon: {
            baseType: 'longsword',
            proficiency: 'martial',
            handedness: 'oneHanded',
            attackType: 'melee',
            dice: '1d8',
            damageTypes: ['slashing'],
            threat: 19,
            mult: 2,
            strengthDamage: 'melee',
          },
        },
      },
      {
        _id: 'huntsman',
        name: 'Huntsman',
        ruleIdentity: 'huntsman',
        modifiers: [],
        detail: {
          kind: 'itemAbility',
          appliesTo: 'weapon',
          bonusEquivalent: 1,
          damageDice: [
            {
              dice: '1d6',
              damageType: 'untyped',
              on: 'hit',
              situation: { local: tracked },
            },
          ],
        },
      },
    ],
  };
  const groups = listCharacterSituationGroups(calculateCharacterSheet(input));
  expect(groups).toEqual([
    expect.objectContaining({
      text: tracked,
      selection: { local: tracked, sheetEntryId: 'sword' },
    }),
  ]);
  const [group] = groups;
  const picked = calculateCharacterSheet(input, {
    situations: [group!.selection],
  });
  expect(picked.attackRoutines[0]?.single[0]?.extraDamage[0]?.applies).toBe(
    true,
  );
});
