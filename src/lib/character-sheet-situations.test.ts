import { expect, test } from 'vitest';
import {
  abilityTargets,
  calculateCharacterSheet,
  resolveSheet,
  type CharacterSheetInput,
  type InputSourcedModifier,
} from './character-sheet';
import { isOwnStateSituation } from './character-sheet-situations';

function sheet(): CharacterSheetInput {
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
        _id: 'feat-row',
        kind: 'manual',
        active: true,
        catalogEntryId: 'feat',
        state: { kind: 'manual' },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: Object.values(abilityTargets).map((target) => ({
          target,
          bonusType: 'base',
          value: 10,
        })),
      },
      {
        _id: 'feat',
        name: 'Fearless',
        ruleIdentity: 'fearless',
        modifiers: [],
        situationalNotes: [
          { target: 'saves', situation: 'fear', text: 'Reroll a failed save.' },
          {
            situation: { local: 'confirming a critical' },
            text: 'Confirm automatically.',
          },
        ],
      },
    ],
  };
}

test('targeted Situational Notes explain parent targets without changing totals; untargeted notes stay with the entry', () => {
  const ordinary = calculateCharacterSheet(sheet());
  const preview = calculateCharacterSheet(sheet(), { situations: ['fear'] });
  expect(ordinary.breakdowns['save.will'].total).toBe(0);
  expect(preview.breakdowns['save.will'].total).toBe(0);
  expect(ordinary.breakdowns['save.will'].notes).toEqual([
    expect.objectContaining({
      sheetEntryId: 'feat-row',
      entryName: 'Fearless',
      situation: 'fear',
      text: 'Reroll a failed save.',
    }),
  ]);
  expect(ordinary.entryNotes).toEqual([
    expect.objectContaining({
      sheetEntryId: 'feat-row',
      situation: { local: 'confirming a critical' },
      text: 'Confirm automatically.',
    }),
  ]);
  expect(ordinary.breakdowns.init.notes ?? []).toEqual([]);
});

test('recorded Spell notes remain with the Spell instead of affecting every casting', () => {
  const input = sheet();
  input.entries = [
    ...input.entries,
    {
      _id: 'spell-row',
      kind: 'spell',
      active: true,
      catalogEntryId: 'spell',
      state: { kind: 'spell' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'spell',
      name: 'Sleep',
      ruleIdentity: 'sleep',
      modifiers: [],
      detail: { kind: 'spell' },
      situationalNotes: [
        {
          target: 'spellDC',
          text: 'Affects only creatures of four Hit Dice or fewer.',
        },
      ],
    },
  ];
  const result = calculateCharacterSheet(input);
  expect(result.entryNotes).toContainEqual(
    expect.objectContaining({
      sheetEntryId: 'spell-row',
      text: 'Affects only creatures of four Hit Dice or fewer.',
    }),
  );
  expect(result.breakdowns.spellDC.notes ?? []).toEqual([]);
});

test('an entry note outside its weapon scope is excluded without waiting for a prerequisite', () => {
  const input = sheet();
  input.catalogEntries = input.catalogEntries.map((catalog) =>
    catalog._id === 'feat'
      ? {
          ...catalog,
          situationalNotes: [
            { text: 'Confirms automatically.', condition: { weapon: '$self' } },
          ],
        }
      : catalog,
  );
  expect(calculateCharacterSheet(input).entryNotes).toEqual([
    expect.objectContaining({ waiting: false, excluded: true }),
  ]);
  expect(
    calculateCharacterSheet(input, {
      weapon: { entryId: 'feat-row', baseType: 'sword' },
    }).entryNotes,
  ).toEqual([expect.objectContaining({ waiting: false, excluded: false })]);
});

test('an active Condition keeps its own-state rule as an entry note without a selectable Situation', () => {
  const input = sheet();
  input.entries = [
    ...input.entries,
    {
      _id: 'bleed-row',
      kind: 'condition',
      active: true,
      catalogEntryId: 'bleed',
      state: { kind: 'condition' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'bleed',
      name: 'Bleed',
      ruleIdentity: 'bleed',
      modifiers: [],
      detail: { kind: 'condition', conditionKey: 'bleed' },
    },
  ];
  const notes = calculateCharacterSheet(input).entryNotes.filter(
    (note) => note.sheetEntryId === 'bleed-row',
  );
  expect(notes.length).toBeGreaterThan(0);
  expect(notes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ text: expect.any(String), waiting: false }),
    ]),
  );
  expect(notes.every((note) => note.situation === undefined)).toBe(true);
});

test('a Condition’s own state matches its name in any case, so its targeted rule stays an untargeted entry note', () => {
  expect(isOwnStateSituation({ local: 'grappled' }, 'Grappled')).toBe(true);
  expect(isOwnStateSituation({ local: 'GRAPPLED' }, 'grappled')).toBe(true);
  expect(isOwnStateSituation({ local: 'pinned' }, 'Grappled')).toBe(false);
  expect(isOwnStateSituation('grappled', 'Grappled')).toBe(false);
  expect(isOwnStateSituation({ local: 'grappled' }, undefined)).toBe(false);
  expect(isOwnStateSituation(undefined, 'Grappled')).toBe(false);

  const input = sheet();
  input.entries = [
    ...input.entries,
    {
      _id: 'held-row',
      kind: 'condition',
      active: true,
      catalogEntryId: 'held',
      state: { kind: 'condition' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'held',
      name: 'Held Fast',
      ruleIdentity: 'held',
      modifiers: [],
      situationalNotes: [
        {
          text: 'Cannot move while held.',
          target: 'ac',
          situation: { local: 'held fast' },
        },
      ],
    },
  ];
  expect(
    calculateCharacterSheet(input).entryNotes.filter(
      (note) => note.sheetEntryId === 'held-row',
    ),
  ).toEqual([
    expect.objectContaining({
      text: 'Cannot move while held.',
      target: undefined,
      situation: undefined,
    }),
  ]);
});

test('scope exclusion takes precedence while an entry note waits only within its casting for an inactive prerequisite', () => {
  const input = sheet();
  input.catalogEntries = input.catalogEntries.map((catalog) =>
    catalog._id === 'feat'
      ? {
          ...catalog,
          situationalNotes: [
            {
              text: 'Reroll a failed concentration check.',
              condition: { castingClass: 'wizard', whileActive: 'focus' },
            },
          ],
        }
      : catalog,
  );
  expect(calculateCharacterSheet(input).entryNotes).toEqual([
    expect.objectContaining({ waiting: false, excluded: true }),
  ]);
  expect(
    calculateCharacterSheet(input, { castingClass: 'wizard' }).entryNotes,
  ).toEqual([expect.objectContaining({ waiting: true, excluded: false })]);
  input.entries = [
    ...input.entries,
    {
      _id: 'focus-row',
      kind: 'manual',
      active: true,
      catalogEntryId: 'focus',
      state: { kind: 'manual' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    { _id: 'focus', ruleIdentity: 'focus', modifiers: [] },
  ];
  expect(
    calculateCharacterSheet(input, { castingClass: 'wizard' }).entryNotes,
  ).toEqual([expect.objectContaining({ waiting: false, excluded: false })]);
});

test('scope mismatches are excluded while inactive dependencies wait separately from selected Situations', () => {
  const modifiers: InputSourcedModifier[] = [
    {
      target: 'save.will',
      value: 2,
      bonusType: 'morale',
      sheetEntryId: 'rage',
      entryName: 'Rage',
      source: 'rage',
      builtIn: false,
    },
    {
      target: 'save.will',
      value: 3,
      bonusType: 'morale',
      sheetEntryId: 'superstition',
      entryName: 'Superstition',
      source: 'superstition',
      builtIn: false,
      condition: { situation: 'spells', whileActive: 'raging' },
    },
    {
      target: 'save.will',
      value: 10,
      bonusType: 'untyped',
      sheetEntryId: 'school',
      entryName: 'School',
      source: 'school',
      builtIn: false,
      condition: { school: 'evocation', situation: 'spells' },
    },
  ];
  const waiting = resolveSheet(modifiers, { situations: ['spells'] })[
    'save.will'
  ];
  expect(waiting.total).toBe(2);
  expect(waiting.conditional.map((row) => row.entryName)).toEqual([
    'Superstition',
  ]);
  expect(waiting.excluded?.map((row) => row.entryName)).toEqual(['School']);
  const active = resolveSheet(modifiers, {
    situations: ['spells'],
    activeCatalogEntryIds: ['raging'],
  })['save.will'];
  expect(active.total).toBe(3);
  expect(active.suppressed[0]?.entryName).toBe('Rage');
});

test('a Routine Option applies only in a context selecting its catalog identity', () => {
  const modifier: InputSourcedModifier = {
    target: 'attack',
    value: -2,
    bonusType: 'untyped',
    sheetEntryId: 'power-attack-row',
    catalogEntryId: 'power-attack',
    entryName: 'Power Attack',
    source: 'power-attack',
    builtIn: false,
    condition: { option: true },
  };
  expect(
    resolveSheet([modifier], { routineOptions: ['power-attack'] })[
      'attack.melee'
    ].total,
  ).toBe(-2);
  expect(
    resolveSheet([modifier], { routineOptions: ['other-option'] })[
      'attack.melee'
    ].total,
  ).toBe(0);
  expect(resolveSheet([modifier])['attack.melee'].excluded).toHaveLength(1);
});

test.each([
  ['spells', 'spellLike'],
  ['charm', 'enchantment'],
  ['flanking', 'melee'],
])(
  'selecting %s does not imply %s, while explicitly selecting both recomputes stacking',
  (selected, unrelated) => {
    const modifiers: InputSourcedModifier[] = [
      {
        target: 'save.will',
        bonusType: 'resistance',
        value: 2,
        condition: { situation: selected },
        sheetEntryId: 'selected-row',
        entryName: 'Selected benefit',
        source: 'selected',
        builtIn: false,
      },
      {
        target: 'save.will',
        bonusType: 'resistance',
        value: 5,
        condition: { situation: unrelated },
        sheetEntryId: 'unrelated-row',
        entryName: 'Unrelated benefit',
        source: 'unrelated',
        builtIn: false,
      },
    ];
    const single = resolveSheet(modifiers, { situations: [selected] })[
      'save.will'
    ];
    expect(single.total).toBe(2);
    expect(single.conditional).toEqual([
      expect.objectContaining({ sheetEntryId: 'unrelated-row' }),
    ]);
    const combined = resolveSheet(modifiers, {
      situations: [selected, unrelated],
    })['save.will'];
    expect(combined.total).toBe(5);
    expect(combined.suppressed).toEqual([
      expect.objectContaining({ sheetEntryId: 'selected-row' }),
    ]);
  },
);

test.each([
  [
    '$self',
    undefined,
    { entryId: 'row', baseType: 'sword' },
    { entryId: 'other', baseType: 'sword' },
  ],
  [
    '$choice',
    'sword',
    { entryId: 'weapon', baseType: 'sword' },
    { entryId: 'weapon', baseType: 'bow' },
  ],
  [
    '$group',
    'blades',
    { entryId: 'weapon', baseType: 'sword', groups: ['close', 'blades'] },
    { entryId: 'weapon', baseType: 'bow', groups: ['bows'] },
  ],
  [
    '$target',
    'weapon',
    { entryId: 'weapon', baseType: 'sword' },
    { entryId: 'other', baseType: 'sword' },
  ],
  [
    '$unarmedOrNatural',
    undefined,
    { entryId: 'weapon', baseType: 'claw', kind: 'natural' },
    { entryId: 'other', baseType: 'sword', kind: 'manufactured' },
  ],
] as const)(
  '%s Situations apply only within their matching weapon scope',
  (weapon, weaponSelection, matching, unrelated) => {
    const modifier: InputSourcedModifier = {
      target: 'attack',
      value: 2,
      bonusType: 'untyped',
      sheetEntryId: 'row',
      entryName: 'Scoped',
      source: 'scoped',
      builtIn: false,
      condition: { weapon, weaponSelection, situation: 'flanking' },
    };
    expect(
      resolveSheet([modifier], { situations: ['flanking'], weapon: matching })[
        'attack.melee'
      ].total,
    ).toBe(2);
    expect(
      resolveSheet([modifier], { situations: ['flanking'], weapon: unrelated })[
        'attack.melee'
      ].total,
    ).toBe(0);
    expect(
      resolveSheet([modifier], { situations: ['melee'], weapon: matching })[
        'attack.melee'
      ].total,
    ).toBe(0);
    expect(
      resolveSheet([modifier], { situations: ['flanking'] })['attack.melee']
        .excluded?.length,
    ).toBe(1);
  },
);
