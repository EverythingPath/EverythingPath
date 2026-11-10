import { assert, expect, test } from 'vitest';
import { conditionDefinitions } from './character-sheet-conditions';

test('the locally authored CRB inventory enumerates all 34 conditions with sources and readable behavior', () => {
  expect(conditionDefinitions.map((condition) => condition.name)).toEqual([
    'Bleed',
    'Blinded',
    'Broken',
    'Confused',
    'Cowering',
    'Dazed',
    'Dazzled',
    'Dead',
    'Deafened',
    'Disabled',
    'Dying',
    'Energy Drained',
    'Entangled',
    'Exhausted',
    'Fascinated',
    'Fatigued',
    'Flat-Footed',
    'Frightened',
    'Grappled',
    'Helpless',
    'Incorporeal',
    'Invisible',
    'Nauseated',
    'Panicked',
    'Paralyzed',
    'Petrified',
    'Pinned',
    'Prone',
    'Shaken',
    'Sickened',
    'Stable',
    'Staggered',
    'Stunned',
    'Unconscious',
  ]);
  for (const condition of conditionDefinitions) {
    expect(condition.sources).toEqual([{ book: 'CRB' }]);
    expect(condition.citations[0]).toMatch(
      /^https:\/\/legacy.aonprd.com\/coreRulebook\/glossary.html#/,
    );
    expect(condition.situationalNotes[0]?.text).toBeTruthy();
  }
});

import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import {
  getConditionDefinition,
  type ConditionKey,
} from './character-sheet-conditions';

function sheet(
  keys: ConditionKey[],
  score = 15,
): CharacterSheetInput & { entries: SheetEntry[] } {
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
      ...keys.map(
        (key, index): SheetEntry => ({
          _id: `row-${index}`,
          kind: 'condition',
          active: true,
          catalogEntryId: `condition-${index}`,
          state: { kind: 'condition' },
        }),
      ),
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: score,
        })),
      },
      ...keys.map((key, index) => ({
        _id: `condition-${index}`,
        ruleIdentity: getConditionDefinition(key).ruleIdentity,
        modifiers: [],
        detail: { kind: 'condition' as const, conditionKey: key },
      })),
    ],
  };
}

test('canonical condition Notes stay with their active entry without a selectable own-state Situation, and replacements do not duplicate them', () => {
  const input = sheet(['fatigued', 'exhausted']);
  const result = calculateCharacterSheet(input);
  expect(result.abilities.strength.score).toBe(9);
  expect(result.entryNotes).toEqual(
    getConditionDefinition('exhausted').situationalNotes.map((note) =>
      expect.objectContaining({
        text: note.text,
        sheetEntryId: 'row-1',
        situation: undefined,
      }),
    ),
  );
  expect(result.entryNotes.some((note) => note.sheetEntryId === 'row-0')).toBe(
    false,
  );
  expect(result.breakdowns['ability.str'].notes ?? []).toEqual([]);
});

test('canonical condition Notes deduplicate equivalent records while retaining same-text rules with different Situations', () => {
  const input = sheet(['bleed']);
  const note = getConditionDefinition('bleed').situationalNotes[0]!;
  input.catalogEntries = input.catalogEntries.map((catalog) =>
    catalog._id === 'condition-0'
      ? {
          ...catalog,
          situationalNotes: [
            { situation: note.situation, text: note.text },
            { text: note.text, situation: 'fear' },
          ],
        }
      : catalog,
  );
  const notes = calculateCharacterSheet(input).entryNotes;
  expect(notes).toHaveLength(2);
  expect(notes).toEqual([
    expect.objectContaining({ noteIndex: 0, situation: undefined }),
    expect.objectContaining({ noteIndex: 1, situation: 'fear' }),
  ]);
});

test('a dormant condition retains its state without affecting the sheet until kept or its source returns', () => {
  const input = sheet(['fatigued']);
  const condition = input.entries.find((entry) => entry.kind === 'condition');
  assert(condition, 'Missing condition');
  condition.grantKey = {
    source: 'feature/fatigue-source',
    entry: getConditionDefinition('fatigued').ruleIdentity,
  };

  const dormant = calculateCharacterSheet(input);
  expect(dormant.abilities.strength.score).toBe(15);
  expect(dormant.abilities.dexterity.score).toBe(15);
  expect(dormant.conditionEffects).toEqual([]);
  expect(dormant.resolvedEntries).toContainEqual(
    expect.objectContaining({
      dormant: true,
      counting: false,
      recorded: true,
      entry: expect.objectContaining({ state: { kind: 'condition' } }),
    }),
  );

  condition.kept = true;
  const kept = calculateCharacterSheet(input);
  expect(kept.abilities.strength.score).toBe(13);
  expect(kept.conditionEffects).toContainEqual(
    expect.objectContaining({ conditionKey: 'fatigued' }),
  );
  expect(kept.warnings).toContainEqual(
    expect.objectContaining({ check: 'keptDormant' }),
  );

  delete condition.kept;
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'fatigue-source',
      ruleIdentity: 'feature/fatigue-source',
      modifiers: [],
      detail: { kind: 'feat' },
      grants: [{ catalogEntryId: 'condition-0' }],
    },
  ];
  input.entries.push({
    _id: 'fatigue-source-row',
    kind: 'feat',
    catalogEntryId: 'fatigue-source',
    active: true,
    state: { kind: 'feat' },
  });
  const restored = calculateCharacterSheetProjections(input);
  expect(restored.current.abilities.strength.score).toBe(13);
  expect(restored.current.conditionEffects).toHaveLength(1);
  expect(restored.current.resolvedEntries).toContainEqual(
    expect.objectContaining({ dormant: false, counting: true, recorded: true }),
  );
  expect(restored.permanent.abilities.strength.score).toBe(15);
  expect(restored.permanent.conditionEffects).toEqual([]);
});

test('Blinded contributes its AC penalty and explains denied Dexterity without changing Reflex or Initiative', () => {
  const { current, permanent } = calculateCharacterSheetProjections(
    sheet(['blinded']),
  );
  expect(current.derivedStatistics.ac.total).toBe(8);
  expect(current.derivedStatistics.touchAc.total).toBe(8);
  expect(current.derivedStatistics.flatFootedAc.total).toBe(8);
  expect(current.derivedStatistics.reflex.total).toBe(2);
  expect(current.derivedStatistics.initiative.total).toBe(2);
  expect(current.derivedStatistics.ac.applied).toContainEqual(
    expect.objectContaining({ entryName: 'Blinded', value: -2 }),
  );
  expect(current.derivedStatistics.ac.suppressed).toContainEqual(
    expect.objectContaining({
      entryName: 'Dexterity',
      value: 2,
      suppressedBy: 'row-0',
    }),
  );
  expect(current.conditionEffects[0]).toMatchObject({
    name: 'Blinded',
    unmodeled: expect.arrayContaining([
      expect.stringContaining('most Strength'),
    ]),
  });
  expect(permanent.derivedStatistics.ac.total).toBe(12);
  expect(permanent.conditionEffects).toEqual([]);
});

test('fear and fatigue escalate by replacement, and pinned replaces every grappled contribution', () => {
  const fear = calculateCharacterSheetProjections(
    sheet(['shaken', 'shaken']),
  ).current;
  expect(fear.breakdowns['attack.melee'].total).toBe(-2);
  expect(fear.conditionEffects).toContainEqual(
    expect.objectContaining({ name: 'Frightened' }),
  );
  const panic = calculateCharacterSheetProjections(
    sheet(['shaken', 'frightened']),
  ).current;
  expect(panic.breakdowns['attack.melee'].total).toBe(-2);
  expect(panic.breakdowns['save.will'].total).toBe(-2);
  expect(panic.conditionEffects).toContainEqual(
    expect.objectContaining({ name: 'Panicked' }),
  );
  for (const keys of [
    ['fatigued', 'fatigued'],
    ['fatigued', 'exhausted'],
  ] satisfies ConditionKey[][]) {
    const result = calculateCharacterSheetProjections(sheet(keys)).current;
    expect(result.abilities.strength.score).toBe(9);
    expect(result.abilities.dexterity.score).toBe(9);
    expect(result.conditionEffects).toContainEqual(
      expect.objectContaining({ name: 'Exhausted' }),
    );
  }
  const pinned = calculateCharacterSheetProjections(
    sheet(['grappled', 'pinned']),
    { situations: ['grapple-or-escape', 'grapple-while-invisible'] },
  ).current;
  expect(pinned.abilities.dexterity.score).toBe(15);
  expect(pinned.breakdowns['attack.melee'].total).toBe(0);
  expect(pinned.breakdowns.cmb.total).toBe(0);
  expect(pinned.breakdowns.cmd.total).toBe(2);
  expect(pinned.breakdowns.cmd.applied).toEqual([
    expect.objectContaining({ sheetEntryId: 'row-1', value: 2 }),
  ]);
  expect(pinned.derivedStatistics.ac.total).toBe(6);
});

// CRB Fear section: "Panicked characters are also shaken"; Shaken is −2 on
// attack rolls, saving throws, skill checks and ability checks (owner ruling
// #725). Fear escalates rather than stacking, so one −2 survives.
test.each([
  [['panicked']],
  [['shaken', 'frightened']],
  [['frightened', 'frightened']],
] satisfies [ConditionKey[]][])(
  'Panicked from %j applies every Shaken penalty once',
  (keys) => {
    const { current } = calculateCharacterSheetProjections(sheet(keys));
    expect(current.breakdowns['attack.melee'].total).toBe(-2);
    expect(current.breakdowns['attack.ranged'].total).toBe(-2);
    expect(current.breakdowns['attack.melee'].applied).toEqual([
      expect.objectContaining({
        sheetEntryId: 'row-0',
        entryName: 'Panicked',
        value: -2,
      }),
    ]);
    expect(current.derivedStatistics.will.total).toBe(0);
    expect(current.derivedStatistics.fortitude.total).toBe(0);
    expect(current.breakdowns['skill.per'].total).toBe(0);
    expect(current.conditionEffects[0]).toMatchObject({
      conditionKey: 'panicked',
      unmodeled: [expect.stringContaining('−2 ability checks')],
    });
    expect(current.conditionEffects[0]?.unmodeled.join(' ')).not.toContain(
      'attack',
    );
  },
);

test('escalated fatigue uses the effective condition Source for persisted Catalog Copies', () => {
  const input = sheet(['fatigued', 'fatigued']);
  input.catalogEntries = input.catalogEntries.map((catalog) => ({
    ...catalog,
    sourceKey: catalog.ruleIdentity,
  }));

  const result = calculateCharacterSheetProjections(input).current;

  expect(result.breakdowns['ability.str'].applied).toContainEqual(
    expect.objectContaining({
      entryName: 'Exhausted',
      value: -6,
      source: 'local/crb-condition/exhausted',
    }),
  );
});

test('different condition penalties stack, with score penalties floored at 1 after other score contributions', () => {
  const ordinary = calculateCharacterSheetProjections(
    sheet(['shaken', 'sickened']),
  ).current;
  expect(ordinary.breakdowns['attack.melee'].total).toBe(-4);
  expect(ordinary.breakdowns['save.fort'].total).toBe(-4);
  expect(ordinary.breakdowns['damage.melee'].total).toBe(-2);
  const low = sheet(['entangled', 'grappled'], 3);
  low.entries.push({
    _id: 'boost-row',
    kind: 'manual',
    active: true,
    catalogEntryId: 'boost',
    state: { kind: 'manual' },
  });
  low.catalogEntries = [
    ...low.catalogEntries,
    {
      _id: 'boost',
      ruleIdentity: 'boost',
      modifiers: [
        { target: 'ability.dex', bonusType: 'enhancement', value: 4 },
      ],
    },
  ];
  const { current, permanent } = calculateCharacterSheetProjections(low);
  expect(current.abilities.dexterity).toEqual({ score: 1, modifier: -5 });
  expect(permanent.abilities.dexterity.score).toBe(7);
  expect(
    current.breakdowns['ability.dex'].applied.reduce(
      (sum, item) => sum + item.value,
      0,
    ),
  ).toBe(1);
  low.entries.push({
    _id: 'drain',
    kind: 'abilityDrain',
    active: true,
    state: { kind: 'abilityDrain', ability: 'dexterity', points: 9 },
  });
  const drained = calculateCharacterSheetProjections(low);
  expect(drained.current.abilities.dexterity.score).toBe(-2);
  expect(drained.permanent.abilities.dexterity.score).toBe(-2);
});

// Worked sheets: six base scores 15 (+2), no class/equipment. CRB appendix
// numbers, with Panicked also shaken (Fear section, #725) and unimplemented
// overrides.
test.each([
  ['bleed', 15, 15, 12, 0, 2, 2, 0],
  ['blinded', 15, 15, 8, 0, 2, 2, 0],
  ['broken', 15, 15, 12, 0, 2, 2, 0],
  ['confused', 15, 15, 12, 0, 2, 2, 0],
  ['cowering', 15, 15, 8, 0, 2, 2, 0],
  ['dazed', 15, 15, 12, 0, 2, 2, 0],
  ['dazzled', 15, 15, 12, -1, 2, 2, 0],
  ['dead', 15, 15, 12, 0, 2, 2, 0],
  ['deafened', 15, 15, 12, 0, 2, -2, 0],
  ['disabled', 15, 15, 12, 0, 2, 2, 0],
  ['dying', 15, 15, 12, 0, 2, 2, 0],
  ['energy-drained', 15, 15, 12, 0, 2, 2, 0],
  ['entangled', 15, 11, 10, -2, 0, 0, 0],
  ['exhausted', 9, 9, 9, 0, -1, -1, 0],
  ['fascinated', 15, 15, 12, 0, 2, 2, 0],
  ['fatigued', 13, 13, 11, 0, 1, 1, 0],
  ['flat-footed', 15, 15, 10, 0, 2, 2, 0],
  ['frightened', 15, 15, 12, -2, 0, 2, 0],
  ['grappled', 15, 11, 10, -2, 0, 0, 0],
  ['helpless', 15, 15, 12, 0, 2, 2, 0],
  ['incorporeal', 15, 15, 12, 0, 2, 2, 0],
  ['invisible', 15, 15, 12, 0, 2, 2, 0],
  ['nauseated', 15, 15, 12, 0, 2, 2, 0],
  ['panicked', 15, 15, 12, -2, 0, 2, 0],
  ['paralyzed', 15, 15, 12, 0, 2, 2, 0],
  ['petrified', 15, 15, 12, 0, 2, 2, 0],
  ['pinned', 15, 15, 6, 0, 2, 2, 0],
  ['prone', 15, 15, 12, -4, 2, 2, 0],
  ['shaken', 15, 15, 12, -2, 0, 2, 0],
  ['sickened', 15, 15, 12, -2, 0, 2, -2],
  ['stable', 15, 15, 12, 0, 2, 2, 0],
  ['staggered', 15, 15, 12, 0, 2, 2, 0],
  ['stunned', 15, 15, 8, 0, 2, 2, 0],
  ['unconscious', 15, 15, 12, 0, 2, 2, 0],
] as const)(
  '%s resolves the current sheet, readable effects and exact permanent exclusion',
  (key, str, dex, ac, attack, reflex, initiative, damage) => {
    const { current, permanent } = calculateCharacterSheetProjections(
      sheet([key]),
    );
    expect(current.abilities.strength.score).toBe(str);
    expect(current.abilities.dexterity.score).toBe(dex);
    expect(current.derivedStatistics.ac.total).toBe(ac);
    expect(current.breakdowns['attack.melee'].total).toBe(attack);
    expect(current.derivedStatistics.reflex.total).toBe(reflex);
    expect(current.derivedStatistics.initiative.total).toBe(initiative);
    expect(current.breakdowns['damage.melee'].total).toBe(damage);
    const effect = current.conditionEffects[0];
    expect(effect?.conditionKey).toBe(key);
    expect(effect?.notes[0]).toBeTruthy();
    expect(permanent).toEqual({
      ...calculateCharacterSheetProjections(sheet([])).permanent,
      resolvedEntries: [
        expect.objectContaining({
          counting: false,
          dormant: false,
          entry: expect.objectContaining({ _id: 'row-0', kind: 'condition' }),
        }),
      ],
    });
    for (const statistic of Object.values(current.breakdowns)) {
      for (const contribution of [
        ...statistic.applied,
        ...statistic.conditional,
      ].filter((item) => item.sheetEntryId === 'row-0'))
        expect(contribution.entryName).toBe(effect?.name);
      expect(statistic.applied.reduce((sum, item) => sum + item.value, 0)).toBe(
        statistic.total,
      );
    }
  },
);

test('situational conditions use the public resolver and preserve excluded contributions', () => {
  const input = sheet([
    'prone',
    'dazzled',
    'blinded',
    'deafened',
    'fascinated',
  ]);
  const ordinary = calculateCharacterSheetProjections(input).current;
  expect(ordinary.breakdowns['skill.per'].total).toBe(2);
  expect(ordinary.breakdowns['skill.per'].conditional).toHaveLength(4);
  const reacted = calculateCharacterSheetProjections(input, {
    situations: [
      'opposed-perception',
      'sight-based',
      'reaction-check',
      'ranged-attack',
    ],
  }).current;
  expect(reacted.breakdowns['skill.per'].total).toBe(-11);
  expect(reacted.derivedStatistics.ac.total).toBe(12);
  const melee = calculateCharacterSheetProjections(sheet(['prone']), {
    situations: ['melee-attack'],
  }).current;
  expect(melee.derivedStatistics.ac.total).toBe(8);
  const sighted = calculateCharacterSheetProjections(sheet(['invisible']), {
    situations: ['sighted-opponent'],
  }).current;
  expect(sighted.breakdowns['attack.melee'].total).toBe(2);
});

test('grappled invisibility supplies only its CMD escape benefit', () => {
  const input = sheet(['invisible', 'grappled', 'invisible']);
  const ordinary = calculateCharacterSheetProjections(input, {
    situations: ['sighted-opponent'],
  }).current;
  expect(ordinary.breakdowns['attack.melee'].total).toBe(-2);
  expect(ordinary.breakdowns['attack.melee'].suppressed).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        sheetEntryId: 'row-0',
        suppressedBy: 'row-1',
        value: 2,
      }),
      expect.objectContaining({
        sheetEntryId: 'row-2',
        suppressedBy: 'row-1',
        value: 2,
      }),
    ]),
  );
  expect(
    ordinary.conditionEffects
      .filter((effect) => effect.conditionKey === 'invisible')
      .every((effect) =>
        effect.notes.includes(
          'While grappled, invisibility grants only +2 CMD to avoid being grappled.',
        ),
      ),
  ).toBe(true);
  expect(ordinary.breakdowns.cmd.total).toBe(0);
  expect(ordinary.breakdowns.cmd.conditional).toEqual([
    expect.objectContaining({
      sheetEntryId: 'row-1',
      entryName: 'Grappled',
      value: 2,
      condition: { situation: 'grapple-while-invisible' },
    }),
  ]);
  const escaping = calculateCharacterSheetProjections(input, {
    situations: ['grapple-while-invisible', 'grapple-or-escape'],
  }).current;
  expect(escaping.breakdowns.cmd.total).toBe(2);
  expect(escaping.breakdowns.cmb.total).toBe(0);
});

// CRB Grappled: an invisible grappled creature "gains a +2 circumstance bonus
// on its CMD to avoid being grappled, but receives no other benefits"; Pinned
// is a more severe version of grappled (owner ruling #725: the limit applies).
test('pinned invisibility supplies only its selectable CMD benefit while every Pinned effect applies', () => {
  for (const keys of [
    ['invisible', 'pinned'],
    ['invisible', 'grappled', 'pinned'],
  ] satisfies ConditionKey[][]) {
    const input = sheet(keys);
    const pinnedRow = `row-${keys.length - 1}`;
    const sighted = calculateCharacterSheetProjections(input, {
      situations: ['sighted-opponent'],
    }).current;
    expect(sighted.breakdowns['attack.melee'].total).toBe(0);
    expect(sighted.breakdowns['attack.melee'].suppressed).toContainEqual(
      expect.objectContaining({
        sheetEntryId: 'row-0',
        entryName: 'Invisible',
        value: 2,
        suppressedBy: pinnedRow,
        reason:
          'While pinned, invisibility grants only +2 CMD to avoid being grappled.',
      }),
    );
    expect(
      sighted.conditionEffects.find((effect) => effect.sheetEntryId === 'row-0')
        ?.notes,
    ).toContain(
      'While pinned, invisibility grants only +2 CMD to avoid being grappled.',
    );
    expect(sighted.abilities.dexterity.score).toBe(15);
    expect(sighted.derivedStatistics.ac.total).toBe(6);
    expect(sighted.derivedStatistics.ac.applied).toContainEqual(
      expect.objectContaining({ sheetEntryId: pinnedRow, value: -4 }),
    );
    expect(sighted.breakdowns.cmb.total).toBe(0);
    expect(sighted.breakdowns.cmd.total).toBe(0);
    expect(sighted.breakdowns.cmd.conditional).toEqual([
      expect.objectContaining({
        sheetEntryId: pinnedRow,
        entryName: 'Pinned',
        value: 2,
        condition: { situation: 'grapple-while-invisible' },
      }),
    ]);

    const escaping = calculateCharacterSheetProjections(input, {
      situations: ['grapple-while-invisible', 'grapple-or-escape'],
    }).current;
    expect(escaping.breakdowns.cmd.total).toBe(2);
    expect(escaping.breakdowns.cmb.total).toBe(0);
  }
});

test('Grappled penalizes ordinary CMB while grapple or escape checks retain other Modifiers', () => {
  const input = sheet(['grappled']);
  input.entries.push({
    _id: 'penalty-row',
    kind: 'manual',
    active: true,
    catalogEntryId: 'penalty',
    state: { kind: 'manual' },
  });
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'penalty',
      ruleIdentity: 'penalty',
      modifiers: [{ target: 'cmb', bonusType: 'untyped', value: -3 }],
    },
  ];

  const ordinary = calculateCharacterSheetProjections(input).current;
  const escaping = calculateCharacterSheetProjections(input, {
    situations: ['grapple-or-escape'],
  }).current;

  expect(ordinary.breakdowns.cmb.total).toBe(-5);
  expect(ordinary.breakdowns.cmb.applied).toContainEqual(
    expect.objectContaining({ entryName: 'Grappled', value: -2 }),
  );
  expect(escaping.breakdowns.cmb.total).toBe(-3);
  expect(escaping.breakdowns.cmb.applied).toContainEqual(
    expect.objectContaining({ sheetEntryId: 'penalty-row', value: -3 }),
  );
});

test('condition normalization preserves while-active Catalog Entry identity and excludes temporary dependencies permanently', () => {
  const input = sheet(['shaken']);
  input.entries.push({
    _id: 'dependent-row',
    kind: 'manual',
    active: true,
    catalogEntryId: 'dependent',
    state: { kind: 'manual' },
  });
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'dependent',
      ruleIdentity: 'dependent',
      modifiers: [
        {
          target: 'init',
          bonusType: 'untyped',
          value: 7,
          condition: { whileActive: 'condition-0' },
        },
      ],
    },
  ];
  const active = calculateCharacterSheetProjections(input);
  expect(active.current.derivedStatistics.initiative.total).toBe(9);
  expect(active.permanent.derivedStatistics.initiative.total).toBe(2);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'condition' && entry._id === 'row-0'
      ? { ...entry, active: false }
      : entry,
  );
  expect(
    calculateCharacterSheetProjections(input).current.derivedStatistics
      .initiative.total,
  ).toBe(2);
});

test('Pinned replaces Grappled numbers while its active Catalog Entry still enables dependent Modifiers', () => {
  const input = sheet(['grappled', 'pinned']);
  input.entries.push({
    _id: 'dependent-row',
    kind: 'manual',
    active: true,
    catalogEntryId: 'dependent',
    state: { kind: 'manual' },
  });
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'dependent',
      ruleIdentity: 'dependent',
      modifiers: [
        {
          target: 'init',
          bonusType: 'untyped',
          value: 7,
          condition: { whileActive: 'condition-0' },
        },
      ],
    },
  ];

  const result = calculateCharacterSheetProjections(input);

  expect(result.current.derivedStatistics.initiative.total).toBe(9);
  expect(result.current.breakdowns['attack.melee'].total).toBe(0);
  expect(result.current.breakdowns['attack.melee'].suppressed).toContainEqual(
    expect.objectContaining({
      sheetEntryId: 'row-0',
      entryName: 'Grappled',
      value: -2,
      suppressedBy: 'row-1',
      reason: 'Replaced by Pinned.',
    }),
  );
  expect(result.permanent.derivedStatistics.initiative.total).toBe(2);
  expect(input.entries.find((entry) => entry._id === 'row-0')?.active).toBe(
    true,
  );
});

test('Pinned explains replaced Grappled Situations whether or not they are selected', () => {
  const input = sheet(['grappled', 'pinned']);
  for (const situations of [
    [],
    ['grapple-or-escape', 'grapple-while-invisible'],
  ]) {
    const result = calculateCharacterSheetProjections(input, {
      situations,
    }).current;

    // Pinned's own invisible CMD Situation (#725) stands in for Grappled's.
    expect(
      [
        ...result.breakdowns.cmd.applied,
        ...result.breakdowns.cmd.conditional,
      ].map(({ sheetEntryId, value }) => ({ sheetEntryId, value })),
    ).toEqual([{ sheetEntryId: 'row-1', value: 2 }]);
    expect(result.breakdowns.cmd.suppressed).toContainEqual(
      expect.objectContaining({
        sheetEntryId: 'row-0',
        value: 2,
        suppressedBy: 'row-1',
        reason: 'Replaced by Pinned.',
      }),
    );
    expect(result.breakdowns.cmb.conditional).toEqual([]);
  }

  input.entries = input.entries.map((entry) =>
    entry.kind === 'condition' && entry._id === 'row-1'
      ? { ...entry, active: false }
      : entry,
  );
  const restored = calculateCharacterSheetProjections(input).current;
  expect(restored.abilities.dexterity.score).toBe(11);
  expect(restored.breakdowns['attack.melee'].total).toBe(-2);
  expect(restored.breakdowns.cmd.suppressed).toEqual([]);
  expect(restored.breakdowns.cmd.conditional).toContainEqual(
    expect.objectContaining({ sheetEntryId: 'row-0', value: 2 }),
  );
});

test('denied Dexterity removes positive Dex and dodge only from AC, retains negative Dex, and flat-footed CMD keeps dodge', () => {
  const input = sheet(['blinded', 'stunned']);
  input.entries.push({
    _id: 'dodge-row',
    kind: 'manual',
    active: true,
    catalogEntryId: 'dodge',
    state: { kind: 'manual' },
  });
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'dodge',
      ruleIdentity: 'dodge',
      modifiers: [{ target: 'ac', bonusType: 'dodge', value: 3 }],
    },
  ];
  const positive = calculateCharacterSheetProjections(input).current;
  expect(positive.derivedStatistics.ac.total).toBe(6);
  expect(positive.derivedStatistics.cmd.total).toBe(13);
  expect(
    calculateCharacterSheetProjections(sheet(['blinded'], 7)).current
      .derivedStatistics.ac.total,
  ).toBe(6);
  const flat = sheet(['flat-footed']);
  const dodgeEntry = input.entries[input.entries.length - 1];
  assert(dodgeEntry !== undefined, 'Missing dodge entry');
  const dodgeCatalogEntry =
    input.catalogEntries[input.catalogEntries.length - 1];
  assert(dodgeCatalogEntry !== undefined, 'Missing dodge catalog entry');
  flat.entries.push(dodgeEntry);
  flat.catalogEntries = [...flat.catalogEntries, dodgeCatalogEntry];
  const result = calculateCharacterSheetProjections(flat).current;
  expect(result.derivedStatistics.ac.total).toBe(10);
  expect(result.derivedStatistics.cmd.total).toBe(15);
});

test('denied dodge bonuses keep their original stacking explanation in the leaf breakdown', () => {
  const input = sheet(['blinded']);
  for (const id of ['haste', 'boots']) {
    input.entries.push({
      _id: id,
      kind: 'manual',
      active: true,
      catalogEntryId: id,
      state: { kind: 'manual' },
    });
    input.catalogEntries = [
      ...input.catalogEntries,
      {
        _id: id,
        ruleIdentity: id,
        sourceKey: 'haste',
        modifiers: [{ target: 'ac', bonusType: 'dodge', value: 1 }],
      },
    ];
  }

  const result = calculateCharacterSheetProjections(input).current;

  expect(result.breakdowns['ac.other'].suppressed).toContainEqual(
    expect.objectContaining({
      sheetEntryId: 'boots',
      suppressedBy: 'haste',
      reason: 'A stronger entry from the same Source applies.',
    }),
  );
  expect(result.derivedStatistics.ac.suppressed).toContainEqual(
    expect.objectContaining({
      sheetEntryId: 'boots',
      suppressedBy: 'row-0',
      reason: 'Dexterity bonus and dodge bonuses are denied by this condition.',
    }),
  );
  expect(result.derivedStatistics.flatFootedAc.suppressed).toContainEqual(
    expect.objectContaining({
      sheetEntryId: 'boots',
      suppressedBy: 'haste',
      reason: 'A stronger entry from the same Source applies.',
    }),
  );
});

test.each([
  'helpless',
  'paralyzed',
  'unconscious',
  'dying',
  'stable',
  'petrified',
] as const)(
  '%s reports unsupported effective zero scores instead of pretending to calculate them',
  (key) => {
    const current = calculateCharacterSheetProjections(sheet([key])).current;
    expect(current.abilities.dexterity.score).toBe(15);
    expect(current.conditionEffects[0]?.unmodeled).toContainEqual(
      expect.stringContaining('Effective Dexterity 0'),
    );
  },
);
