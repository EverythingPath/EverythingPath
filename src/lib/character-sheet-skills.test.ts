import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import { resolveEquipment } from './character-sheet-equipment';
import { resolveSkills } from './character-sheet-skills';
import { resolveAdvancement } from './character-sheet-advancement';
import { representativeClassCatalog } from '../../tests/fixtures/catalog/representative-class-progressions';

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
      ...[1, 2].map(
        (position): SheetEntry => ({
          _id: `level-${position}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            position,
            classEntryId: position === 1 ? 'fighter' : 'rogue',
            hpGained: 5,
            skillRanks: { 'skill.clm': 1 },
          },
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
          value: ability === 'strength' ? 16 : ability === 'charisma' ? 14 : 10,
        })),
      },
      ...representativeClassCatalog.map((entry) => ({
        ...entry,
        detail: { ...entry.detail, classSkills: ['skill.clm', 'skill.int'] },
      })),
    ],
  };
}

test('multiclass skills add recorded ranks, the class-skill bonus once and the current ability, with named contributions', () => {
  // CRB Skills: one +3 with at least one rank, irrespective of how many classes grant the skill.
  const result = calculateCharacterSheet(sheet());
  expect(
    result.skills.find((skill) => skill.key === 'skill.clm'),
  ).toMatchObject({
    ranks: 2,
    classSkill: true,
    ability: 'strength',
  });
  expect(result.breakdowns['skill.clm'].total).toBe(8);
  expect(result.breakdowns['skill.clm'].applied).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        sheetEntryId: 'level-1',
        bonusType: 'base',
        value: 1,
      }),
      expect.objectContaining({
        sheetEntryId: 'level-2',
        bonusType: 'base',
        value: 1,
      }),
      expect.objectContaining({ entryName: 'Class skill', value: 3 }),
      expect.objectContaining({ entryName: 'Strength', value: 3 }),
    ]),
  );
  expect(
    result.skills.find((skill) => skill.key === 'skill.int'),
  ).toMatchObject({
    ranks: 0,
    classSkill: true,
    ability: 'charisma',
  });
});

test.each([
  ['skill.clm', 4, -4],
  ['skill.acr', -4, -4],
  ['skill.swm', -1, -4],
  ['skill.int', 2, 0],
  ['skill.per', 0, 0],
] as const)(
  'active armor and shields apply once to %s',
  (key, total, penalty) => {
    // CRB Skills and Armor: ACP sums for Str/Dex skills, including Swim; masterwork reduces its magnitude by one.
    const input = sheet();
    const result = calculateCharacterSheet({
      ...input,
      entries: [
        ...input.entries,
        {
          _id: 'armor-row',
          kind: 'item',
          active: true,
          catalogEntryId: 'armor',
          state: { kind: 'item', masterwork: true },
        },
        {
          _id: 'shield-row',
          kind: 'item',
          active: true,
          catalogEntryId: 'shield',
          state: { kind: 'item', enhancement: 1 },
        },
        {
          _id: 'inactive-row',
          kind: 'item',
          active: false,
          catalogEntryId: 'inactive',
          state: { kind: 'item' },
        },
      ],
      catalogEntries: [
        ...input.catalogEntries,
        {
          _id: 'armor',
          name: 'Armor',
          ruleIdentity: 'armor',
          modifiers: [],
          detail: {
            kind: 'item',
            armor: { slot: 'armor', armorCheckPenalty: 4 },
          },
        },
        {
          _id: 'shield',
          name: 'Shield',
          ruleIdentity: 'shield',
          modifiers: [],
          detail: {
            kind: 'item',
            armor: { slot: 'shield', armorCheckPenalty: 2 },
          },
        },
        {
          _id: 'inactive',
          ruleIdentity: 'inactive',
          modifiers: [],
          detail: {
            kind: 'item',
            armor: { slot: 'armor', armorCheckPenalty: 9 },
          },
        },
      ],
    });
    expect(result.skills.find((skill) => skill.key === key)).toMatchObject({
      armorCheckPenalty: penalty,
    });
    expect(result.breakdowns[key].total).toBe(total);
    if (penalty)
      expect(result.breakdowns[key].applied).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sheetEntryId: 'builtin:armor-check-penalty:armor-row',
            entryName: 'Armor armor check penalty',
            value: -3,
          }),
          expect.objectContaining({
            sheetEntryId: 'builtin:armor-check-penalty:shield-row',
            entryName: 'Shield armor check penalty',
            value: -1,
          }),
        ]),
      );
  },
);

test('an armor check penalty stacks with an untyped penalty from the same armor', () => {
  // CRB Skills: penalties are untyped and stack; ACP is its own contribution.
  const input = sheet();
  const result = calculateCharacterSheet({
    ...input,
    entries: [
      ...input.entries,
      {
        _id: 'armor-row',
        kind: 'item',
        active: true,
        catalogEntryId: 'noisy-armor',
        state: { kind: 'item' },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'noisy-armor',
        name: 'Noisy armor',
        ruleIdentity: 'noisy-armor',
        modifiers: [{ target: 'skill.ste', bonusType: 'untyped', value: -1 }],
        detail: {
          kind: 'item',
          armor: { slot: 'armor', armorCheckPenalty: 3 },
        },
      },
    ],
  });
  expect(result.breakdowns['skill.ste'].total).toBe(-4);
  expect(result.breakdowns['skill.ste'].applied).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        entryName: 'Noisy armor armor check penalty',
        value: -3,
      }),
      expect.objectContaining({
        sheetEntryId: 'armor-row',
        entryName: 'Noisy armor',
        value: -1,
      }),
    ]),
  );
  expect(result.breakdowns['skill.ste'].suppressed).toEqual([]);
});

test('skill totals use current ability damage and temporary effects, while permanent skill totals exclude them', () => {
  const input = sheet();
  const result = calculateCharacterSheetProjections({
    ...input,
    entries: [
      ...input.entries,
      {
        _id: 'spell-row',
        kind: 'spellEffect',
        active: true,
        catalogEntryId: 'spell',
        state: { kind: 'spellEffect', casterLevel: 3 },
      },
      {
        _id: 'damage',
        kind: 'abilityDamage',
        active: true,
        state: { kind: 'abilityDamage', ability: 'strength', points: 2 },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'spell',
        ruleIdentity: 'spell',
        detail: { kind: 'spellEffect' },
        modifiers: [
          { target: 'ability.str', bonusType: 'enhancement', value: 4 },
        ],
      },
    ],
  });
  expect(result.current.breakdowns['skill.clm'].total).toBe(9);
  expect(result.permanent.breakdowns['skill.clm'].total).toBe(8);
});

test('per-level budgets use permanent Intelligence retroactively and retain over-budget allocations with inline warnings', () => {
  // #215 resolution: max(1, class ranks + permanent Int), then racial/favored ranks.
  const input = sheet();
  input.entries = input.entries.map((entry) =>
    entry.kind === 'classLevel' && entry.state.position === 1
      ? { ...entry, state: { ...entry.state, skillRanks: { 'skill.clm': 5 } } }
      : entry,
  );
  const result = calculateCharacterSheet(input);
  expect(result.budgets).toMatchObject({
    kind: 'ordinary',
    intelligenceModifier: 0,
    skillRanks: 10,
  });
  expect(result.classLevels[0]).toMatchObject({
    skillRankBudget: 2,
    skillRanksSpent: 5,
    skillRanksRemaining: -3,
  });
  expect(result.warnings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'rules',
        check: 'skillRankBudget',
        target: { kind: 'classLevel', entryId: 'level-1', field: 'skillRanks' },
      }),
      expect.objectContaining({
        kind: 'incomplete',
        check: 'skillRanksUnspent',
        target: { kind: 'classLevel', entryId: 'level-2', field: 'skillRanks' },
      }),
    ]),
  );
  expect(result.skills.find((skill) => skill.key === 'skill.clm')?.ranks).toBe(
    6,
  );
});

test('cumulative caps use racial Hit Dice plus recorded Class Level position', () => {
  const input = sheet();
  const result = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'classLevel'
        ? {
            ...entry,
            state: {
              ...entry.state,
              position: entry.state.position === 1 ? 1 : 5,
              skillRanks: { 'skill.clm': entry.state.position === 1 ? 4 : 3 },
            },
          }
        : entry,
    ),
    racialHitDice: {
      count: 2,
      hpGained: 8,
      progression: {
        bab: 'half',
        saves: { fort: 'poor', ref: 'poor', will: 'poor' },
        skillRanksPerHitDie: 1,
      },
    },
  });
  expect(result.budgets.racialSkillRanks).toBe(2);
  expect(result.classLevels).toMatchObject([
    {
      position: 1,
      hitDice: 3,
      skillRankCap: 3,
      cumulativeSkillRanks: [{ skill: 'skill.clm', ranks: 4 }],
      exceededSkillRankCaps: [{ skill: 'skill.clm', ranks: 4 }],
    },
    {
      position: 5,
      hitDice: 7,
      skillRankCap: 7,
      cumulativeSkillRanks: [{ skill: 'skill.clm', ranks: 7 }],
      exceededSkillRankCaps: [],
    },
  ]);
  expect(result.breakdowns['skill.clm'].total).toBe(13);
});

test.each([
  { intelligence: 6, firstBudget: 2, secondBudget: 6, total: 8 },
  { intelligence: 14, firstBudget: 5, secondBudget: 10, total: 15 },
])(
  'permanent Intelligence $intelligence applies retroactively before favored ranks',
  ({ intelligence, firstBudget, secondBudget, total }) => {
    // #215 / CRB glossary: permanent Int retroactively; floor before favored ranks; alternate favored text grants no guessed ranks.
    const input = sheet();
    const result = calculateCharacterSheetProjections({
      ...input,
      entries: [
        ...input.entries.map((entry) =>
          entry.kind === 'classLevel'
            ? ({
                ...entry,
                state: {
                  ...entry.state,
                  favoredClassBonus:
                    entry.state.position === 1
                      ? { choice: 'skill' }
                      : { choice: 'alt', note: 'One-sixth of a talent' },
                },
              } satisfies SheetEntry)
            : entry,
        ),
        {
          _id: 'temporary-row',
          kind: 'condition',
          active: true,
          catalogEntryId: 'temporary',
          state: { kind: 'condition' },
        },
        {
          _id: 'damage',
          kind: 'abilityDamage',
          active: true,
          state: { kind: 'abilityDamage', ability: 'intelligence', points: 2 },
        },
      ],
      catalogEntries: [
        ...input.catalogEntries.map((entry) =>
          entry._id === 'base'
            ? {
                ...entry,
                modifiers: entry.modifiers.map((modifier) =>
                  modifier.target === 'ability.int'
                    ? { ...modifier, value: intelligence }
                    : modifier,
                ),
              }
            : entry,
        ),
        {
          _id: 'temporary',
          ruleIdentity: 'temporary',
          detail: { kind: 'condition' },
          modifiers: [
            { target: 'ability.int', bonusType: 'enhancement', value: 8 },
          ],
        },
      ],
    });
    expect(
      result.current.classLevels.map((row) => row.skillRankBudget),
    ).toEqual([firstBudget, secondBudget]);
    expect(result.current.budgets.skillRanks).toBe(total);
    expect(result.current.budgets).toEqual(result.permanent.budgets);
  },
);

test('an Unspecified Class Level retains ranks and reports an unresolved budget without inventing a class bonus', () => {
  const input = sheet();
  const result = calculateCharacterSheet({
    ...input,
    entries: input.entries.flatMap((entry): SheetEntry[] =>
      entry.kind === 'classLevel'
        ? entry.state.position === 1
          ? [{ ...entry, state: { ...entry.state, classEntryId: null } }]
          : []
        : [entry],
    ),
  });
  expect(result.classLevels[0]).toMatchObject({
    skillRankBudget: null,
    skillRanksRemaining: null,
    skillRanksSpent: 1,
  });
  expect(result.budgets.skillRanks).toBeNull();
  expect(
    result.skills.find((skill) => skill.key === 'skill.clm'),
  ).toMatchObject({ ranks: 1, classSkill: false });
  expect(result.breakdowns['skill.clm'].total).toBe(4);
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      kind: 'unresolved',
      check: 'skillRankBudgetUnresolved',
      target: { kind: 'classLevel', entryId: 'level-1', field: 'skillRanks' },
    }),
  );
});

test('cumulative caps combine canonical and legacy rank keys', () => {
  const input = sheet();
  const withRanks = (skillRanks: Record<string, number>) =>
    calculateCharacterSheet({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'classLevel' && entry.state.position === 1
          ? { ...entry, state: { ...entry.state, skillRanks } }
          : entry,
      ),
    });
  const aliased = withRanks({ clm: 1, 'skill.clm': 2 });
  const canonical = withRanks({ 'skill.clm': 3 });
  expect(aliased.classLevels[0]?.cumulativeSkillRanks).toEqual([
    { skill: 'skill.clm', ranks: 3 },
  ]);
  expect(
    aliased.warnings.find(
      (warning) =>
        warning.subject === 'level-1' && warning.check === 'skillRankCap',
    ),
  ).toEqual(
    canonical.warnings.find(
      (warning) =>
        warning.subject === 'level-1' && warning.check === 'skillRankCap',
    ),
  );
});

function withArmor({
  enhancement,
  armorCheckPenalty = 4,
  active = true,
  consumable = false,
}: {
  enhancement?: number;
  armorCheckPenalty?: number;
  active?: boolean;
  consumable?: boolean;
}): CharacterSheetInput {
  const input = sheet();
  return {
    ...input,
    entries: [
      ...input.entries,
      {
        _id: 'armor-row',
        kind: 'item',
        active,
        catalogEntryId: 'armor',
        state: { kind: 'item', enhancement },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'armor',
        name: 'Chainmail',
        ruleIdentity: 'armor',
        modifiers: [],
        detail: {
          kind: 'item',
          consumable,
          armor: { slot: 'armor', armorCheckPenalty },
        },
      },
    ],
  };
}

test.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
  'active malformed enhancement %s leaves the armor penalty unresolved and unrelated skills intact',
  (enhancement) => {
    const result = calculateCharacterSheet(withArmor({ enhancement }));
    const baseline = calculateCharacterSheet(sheet());
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        kind: 'unresolved',
        check: 'armorCheckPenaltyUnresolved',
        subject: 'armor-row',
        target: { kind: 'entry', entryId: 'armor-row' },
        message: expect.stringMatching(
          /Chainmail.*unresolved.*Enhancement.*Strength and Dexterity skill totals/,
        ),
      }),
    );
    // These retain their known contributions, accompanied by the unresolved penalty warning.
    expect(result.breakdowns['skill.clm'].total).toBe(8);
    expect(result.breakdowns['skill.acr'].total).toBe(0);
    for (const skill of result.skills) {
      if (skill.ability === 'strength' || skill.ability === 'dexterity')
        expect(result.breakdowns[skill.key].applied).not.toContainEqual(
          expect.objectContaining({
            sheetEntryId: 'builtin:armor-check-penalty:armor-row',
          }),
        );
      else
        expect(result.breakdowns[skill.key]).toEqual(
          baseline.breakdowns[skill.key],
        );
    }
  },
);

test.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
  'active malformed armor check penalty %s keeps valid armor contributions and warns once at its source',
  (armorCheckPenalty) => {
    const input = withArmor({ armorCheckPenalty });
    const result = calculateCharacterSheet({
      ...input,
      entries: [
        ...input.entries,
        {
          _id: 'shield-row',
          kind: 'item',
          active: true,
          catalogEntryId: 'shield',
          state: { kind: 'item', enhancement: 1 },
        },
      ],
      catalogEntries: [
        ...input.catalogEntries,
        {
          _id: 'shield',
          name: 'Shield',
          ruleIdentity: 'shield',
          modifiers: [],
          detail: {
            kind: 'item',
            armor: { slot: 'shield', armorCheckPenalty: 2 },
          },
        },
      ],
    });
    const warning = expect.objectContaining({
      kind: 'unresolved',
      check: 'armorCheckPenaltyUnresolved',
      subject: 'armor-row',
      target: { kind: 'entry', entryId: 'armor-row' },
      message: expect.stringContaining(
        "Armor check penalty must be a nonnegative number. This item's penalty is omitted",
      ),
    });
    expect(
      result.warnings.filter(
        (item) => item.check === 'armorCheckPenaltyUnresolved',
      ),
    ).toEqual([warning]);
    expect(result.warningsForAcceptance).toContainEqual(warning);
    expect(result.breakdowns['skill.clm'].total).toBe(7);
    expect(result.breakdowns['skill.acr'].total).toBe(-1);
    for (const skill of result.skills) {
      if (skill.ability === 'strength' || skill.ability === 'dexterity') {
        expect(result.breakdowns[skill.key].applied).toContainEqual(
          expect.objectContaining({
            sheetEntryId: 'builtin:armor-check-penalty:shield-row',
            value: -1,
          }),
        );
        expect(result.breakdowns[skill.key].applied).not.toContainEqual(
          expect.objectContaining({
            sheetEntryId: 'builtin:armor-check-penalty:armor-row',
          }),
        );
      } else
        expect(result.breakdowns[skill.key]).toEqual(
          calculateCharacterSheet(sheet()).breakdowns[skill.key],
        );
    }
  },
);

test.each([
  { enhancement: -1 },
  { enhancement: 0.5 },
  { enhancement: Number.NaN },
  { enhancement: Number.POSITIVE_INFINITY },
  { armorCheckPenalty: -1 },
  { armorCheckPenalty: Number.NaN },
  { armorCheckPenalty: Number.POSITIVE_INFINITY },
  { armorCheckPenalty: Number.NEGATIVE_INFINITY },
])('inactive malformed armor %j never affects skills or warnings', (values) => {
  const baseline = calculateCharacterSheet(sheet());
  const result = calculateCharacterSheet(
    withArmor({ ...values, active: false }),
  );
  expect(result.breakdowns).toEqual(baseline.breakdowns);
  expect(result.warnings).toEqual(baseline.warnings);
});

test('temporary malformed armor warns in the current projection and contributes nothing to permanent skills', () => {
  const baseline = calculateCharacterSheet(sheet());
  const { current, permanent } = calculateCharacterSheetProjections(
    withArmor({ enhancement: -1, consumable: true }),
  );
  expect(current.warnings).toContainEqual(
    expect.objectContaining({ check: 'armorCheckPenaltyUnresolved' }),
  );
  expect(permanent.warnings).toEqual(baseline.warnings);
  expect(permanent.breakdowns).toEqual(baseline.breakdowns);
});

test('non-armor items with malformed enhancement leave skill calculations unchanged', () => {
  const input = withArmor({ enhancement: -1 });
  const result = calculateCharacterSheet({
    ...input,
    catalogEntries: input.catalogEntries.map((entry) =>
      entry._id === 'armor' ? { ...entry, detail: { kind: 'item' } } : entry,
    ),
  });
  const baseline = calculateCharacterSheet(sheet());
  expect(result.breakdowns).toEqual(baseline.breakdowns);
  expect(result.warnings).toEqual(baseline.warnings);
});

test('finite fractional armor penalties remain valid', () => {
  const result = calculateCharacterSheet(withArmor({ armorCheckPenalty: 1.5 }));
  expect(result.breakdowns['skill.clm'].total).toBe(6.5);
  expect(result.warnings).not.toContainEqual(
    expect.objectContaining({ check: 'armorCheckPenaltyUnresolved' }),
  );
});

test('unresolved armor warnings reopen when malformed nonfinite facts change', () => {
  const fingerprints = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ].map(
    (enhancement) =>
      calculateCharacterSheet(withArmor({ enhancement })).warnings.find(
        (warning) => warning.check === 'armorCheckPenaltyUnresolved',
      )?.fingerprint,
  );
  expect(fingerprints).not.toContain(undefined);
  expect(new Set(fingerprints).size).toBe(3);
});

test('resolving skills returns new breakdowns without changing the supplied statistics', () => {
  const input = sheet();
  const calculated = calculateCharacterSheet(input);
  const before = structuredClone(calculated.breakdowns);
  for (const statistic of Object.values(calculated.breakdowns)) {
    Object.freeze(statistic.applied);
    Object.freeze(statistic.suppressed);
    Object.freeze(statistic.conditional);
    Object.freeze(statistic);
  }
  Object.freeze(calculated.breakdowns);
  const resolved = resolveSkills({
    equipment: resolveEquipment({
      input,
      proficiencies: calculated.proficiencies,
    }),
    advancement: resolveAdvancement(input),
    abilities: calculated.abilities,
    breakdowns: calculated.breakdowns,
  });
  expect(
    resolved.skills.find((skill) => skill.key === 'skill.clm'),
  ).toMatchObject({ ranks: 2, classSkill: true });
  expect(resolved.breakdowns['skill.clm']).not.toBe(
    calculated.breakdowns['skill.clm'],
  );
  expect(calculated.breakdowns).toEqual(before);
});
