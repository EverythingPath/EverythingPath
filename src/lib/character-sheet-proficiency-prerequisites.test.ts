import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';

function level(
  position: number,
  classEntryId = 'fighter',
): Extract<SheetEntry, { kind: 'classLevel' }> {
  return {
    _id: `level-${position}`,
    kind: 'classLevel',
    active: true,
    state: { kind: 'classLevel', position, classEntryId, hpGained: 5 },
  };
}

function feat(
  id: string,
  options: { level?: string; order?: number; choice?: string } = {},
): Extract<SheetEntry, { kind: 'feat' }> {
  return {
    _id: id,
    catalogEntryId: id,
    kind: 'feat',
    active: true,
    gainedAtClassLevel: options.level,
    choiceOrder: options.order,
    state: { kind: 'feat', choice: options.choice },
  };
}

function sheet(
  entries: SheetEntry[],
  catalogEntries: CharacterSheetCatalogEntry[],
): CharacterSheetInput {
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
      level(1),
      ...entries,
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 10,
        })),
      },
      {
        _id: 'fighter',
        name: 'Fighter',
        ruleIdentity: 'class/fighter',
        modifiers: [],
        proficiencies: [{ category: 'martial' }],
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 10,
          bab: 'full',
          saves: { fort: 'good', ref: 'poor', will: 'poor' },
          skillRanksPerLevel: 2,
        },
      },
      ...catalogEntries,
    ],
  };
}

test('legacy proficiency Accepted Warnings retain their subject and fingerprint after typed clauses are added', () => {
  const input = sheet(
    [feat('required', { level: 'level-1', order: 0 })],
    [
      {
        _id: 'required',
        ruleIdentity: 'feat/required',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [{ ability: 'strength', min: 13 }],
        proficiencyPrerequisites: [
          { kind: 'proficiency', proficiency: { category: 'heavy' } },
        ],
      },
    ],
  );
  const accepted = [
    {
      subject: 'required:current:0',
      fingerprint:
        '["category:heavy","category:heavy",{"granted":[],"removed":[]},null]',
    },
    {
      subject: 'required:recorded:0',
      fingerprint:
        '["category:heavy","category:heavy",{"granted":[],"removed":[]},null]',
    },
  ];
  expect(
    calculateCharacterSheet(input)
      .warnings.filter(({ check }) => check === 'proficiencyPrerequisite')
      .map(({ subject, fingerprint }) => ({ subject, fingerprint })),
  ).toEqual(accepted);
});

test('tagged typed proficiency clauses reuse matching legacy warning acceptance identities once', () => {
  const input = sheet(
    [feat('required')],
    [
      {
        _id: 'required',
        ruleIdentity: 'feat/required',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [
          { kind: 'proficiency', proficiency: { category: 'heavy' } },
        ],
        proficiencyPrerequisites: [
          { kind: 'proficiency', proficiency: { category: 'heavy' } },
        ],
      },
    ],
  );
  const result = calculateCharacterSheet(input);
  expect(result.prerequisites).toHaveLength(1);
  expect(result.proficiencyPrerequisites).toHaveLength(1);
  expect(
    result.warnings
      .filter(({ check }) => check === 'proficiencyPrerequisite')
      .map(({ subject, fingerprint }) => ({ subject, fingerprint })),
  ).toEqual([
    {
      subject: 'required:current:0',
      fingerprint:
        '["category:heavy","category:heavy",{"granted":[],"removed":[]},null]',
    },
  ]);
});

test('a fighter satisfies a martial proficiency prerequisite without the named feat', () => {
  const result = calculateCharacterSheet(
    sheet(
      [feat('training', { level: 'level-1', order: 0 })],
      [
        {
          _id: 'training',
          ruleIdentity: 'feat/training',
          modifiers: [],
          detail: { kind: 'feat' },
          proficiencyPrerequisites: [
            { kind: 'proficiency', proficiency: { category: 'martial' } },
          ],
        },
      ],
    ),
  );
  expect(result.proficiencyPrerequisites).toEqual([
    {
      entryId: 'training',
      view: 'current',
      proficiency: { category: 'martial' },
      met: true,
    },
    {
      entryId: 'training',
      view: 'recorded',
      proficiency: { category: 'martial' },
      met: true,
    },
  ]);
  expect(
    result.warnings.filter(
      (warning) => warning.check === 'proficiencyPrerequisite',
    ),
  ).toEqual([]);
});

test('a selected-weapon prerequisite uses the choice and its catalog category', () => {
  const result = calculateCharacterSheet(
    sheet(
      [feat('weapon-focus', { choice: 'Longsword' })],
      [
        {
          _id: 'weapon-focus',
          name: 'Weapon Focus',
          ruleIdentity: 'feat/weapon-focus',
          modifiers: [],
          detail: { kind: 'feat' },
          proficiencyPrerequisites: [
            { kind: 'proficiency', proficiency: { choice: true } },
          ],
        },
        {
          _id: 'longsword',
          ruleIdentity: 'weapon/longsword',
          modifiers: [],
          detail: {
            kind: 'item',
            weapon: { baseType: 'longsword', proficiency: 'martial' },
          },
        },
      ],
    ),
  );
  expect(result.proficiencyPrerequisites).toEqual([
    {
      entryId: 'weapon-focus',
      view: 'current',
      proficiency: { baseType: 'Longsword' },
      met: true,
    },
  ]);
});

test('a recorded choice cannot borrow its own or later grants and follows edited order', () => {
  const input = sheet(
    [
      feat('requires-heavy', { level: 'level-1', order: 1 }),
      feat('later-training', { level: 'level-1', order: 2 }),
    ],
    [
      {
        _id: 'requires-heavy',
        ruleIdentity: 'feat/requires-heavy',
        modifiers: [],
        detail: { kind: 'feat' },
        grants: [{ catalogEntryId: 'heavy-training' }],
        proficiencyPrerequisites: [
          { kind: 'proficiency', proficiency: { category: 'heavy' } },
        ],
      },
      {
        _id: 'later-training',
        ruleIdentity: 'feat/later-training',
        modifiers: [],
        detail: { kind: 'feat' },
        grants: [{ catalogEntryId: 'heavy-training' }],
      },
      {
        _id: 'heavy-training',
        ruleIdentity: 'feature/heavy-training',
        modifiers: [],
        detail: { kind: 'classFeature' },
        proficiencies: [{ category: 'heavy' }],
      },
    ],
  );
  const checks = calculateCharacterSheet(input).proficiencyPrerequisites;
  expect(checks).toEqual([
    {
      entryId: 'requires-heavy',
      view: 'current',
      proficiency: { category: 'heavy' },
      met: true,
    },
    {
      entryId: 'requires-heavy',
      view: 'recorded',
      proficiency: { category: 'heavy' },
      met: false,
    },
  ]);
  input.entries = input.entries.map((entry) =>
    entry._id === 'later-training' ? { ...entry, choiceOrder: 0 } : entry,
  );
  expect(calculateCharacterSheet(input).proficiencyPrerequisites[1]?.met).toBe(
    true,
  );
});

test('prerequisite warning fingerprints follow relevant inputs and ignore unrelated order changes', () => {
  const input = sheet(
    [
      feat('heavy-use', { level: 'level-1', order: 1 }),
      feat('peer', { level: 'level-1', order: 0 }),
    ],
    [
      {
        _id: 'peer',
        ruleIdentity: 'feat/peer',
        modifiers: [],
        detail: { kind: 'feat' },
      },
      {
        _id: 'heavy-use',
        ruleIdentity: 'feat/heavy-use',
        modifiers: [],
        detail: { kind: 'feat' },
        proficiencyPrerequisites: [
          { kind: 'proficiency', proficiency: { category: 'heavy' } },
        ],
      },
    ],
  );
  const warnings = () =>
    calculateCharacterSheet(input).warnings.filter(
      (warning) => warning.check === 'proficiencyPrerequisite',
    );
  const original = warnings();
  expect(original.map((warning) => [warning.subject, warning.target])).toEqual([
    ['heavy-use:current:0', { kind: 'entry', entryId: 'heavy-use' }],
    ['heavy-use:recorded:0', { kind: 'entry', entryId: 'heavy-use' }],
  ]);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'base'
      ? {
          ...entry,
          state: {
            ...entry.state,
            proficiencies: { added: [{ category: 'shield' }], removed: [] },
          },
        }
      : entry,
  );
  expect(warnings().map((warning) => warning.fingerprint)).toEqual(
    original.map((warning) => warning.fingerprint),
  );
  input.entries = input.entries.map((entry) =>
    entry.kind === 'base'
      ? {
          ...entry,
          state: {
            ...entry.state,
            proficiencies: {
              added: [{ category: 'heavy' }],
              removed: [{ category: 'heavy' }],
            },
          },
        }
      : entry,
  );
  const changedInputs = warnings();
  expect(changedInputs[0]?.fingerprint).not.toBe(original[0]?.fingerprint);
  expect(changedInputs[1]?.fingerprint).not.toBe(original[1]?.fingerprint);
  input.entries = input.entries.map((entry) =>
    entry._id === 'heavy-use' ? { ...entry, choiceOrder: -1 } : entry,
  );
  const reordered = warnings();
  expect(reordered[0]?.fingerprint).toBe(changedInputs[0]?.fingerprint);
  expect(reordered[1]?.fingerprint).toBe(changedInputs[1]?.fingerprint);
});

test('a named weapon without modeled weapon facts is unchecked until a direct proficiency decides it', () => {
  const input = sheet(
    [feat('unknown-weapon')],
    [
      {
        _id: 'unknown-weapon',
        ruleIdentity: 'feat/unknown-weapon',
        modifiers: [],
        detail: { kind: 'feat' },
        proficiencyPrerequisites: [
          { kind: 'proficiency', proficiency: { baseType: 'unmapped blade' } },
        ],
      },
    ],
  );
  expect(calculateCharacterSheet(input).proficiencyPrerequisites).toEqual([]);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'base'
      ? {
          ...entry,
          state: {
            ...entry.state,
            proficiencies: {
              added: [{ baseType: 'unmapped blade' }],
              removed: [],
            },
          },
        }
      : entry,
  );
  expect(calculateCharacterSheet(input).proficiencyPrerequisites).toEqual([
    {
      entryId: 'unknown-weapon',
      view: 'current',
      proficiency: { baseType: 'unmapped blade' },
      met: true,
    },
  ]);
});

test('a feat from a prerequisite-exempt slot skips both views', () => {
  const chosen = feat('heavy-use', { level: 'level-1', order: 0 });
  const result = calculateCharacterSheet(
    sheet(
      [
        {
          _id: 'bonus-slot',
          kind: 'classFeature',
          active: true,
          catalogEntryId: 'bonus-slot',
          state: { kind: 'classFeature' },
        },
        {
          ...chosen,
          selectionSource: {
            kind: 'slot',
            grantedBy: { kind: 'entry', entryId: 'bonus-slot' },
          },
        },
      ],
      [
        {
          _id: 'bonus-slot',
          ruleIdentity: 'feature/bonus-slot',
          modifiers: [],
          detail: { kind: 'classFeature' },
          grantsSlots: [{ kind: 'feat', count: 1, ignoresPrerequisites: true }],
        },
        {
          _id: 'heavy-use',
          ruleIdentity: 'feat/heavy-use',
          modifiers: [],
          detail: { kind: 'feat' },
          proficiencyPrerequisites: [
            { kind: 'proficiency', proficiency: { category: 'heavy' } },
          ],
        },
      ],
    ),
  );
  expect(result.proficiencyPrerequisites).toEqual([]);
});

test('a kept recorded grant still shares its source choice position', () => {
  const result = calculateCharacterSheet(
    sheet(
      [
        feat('heavy-use', { level: 'level-1', order: 0 }),
        {
          _id: 'recorded-grant',
          kind: 'classFeature',
          active: true,
          kept: true,
          catalogEntryId: 'heavy-training',
          grantKey: { source: 'heavy-use', entry: 'feature/heavy-training' },
          state: { kind: 'classFeature' },
        },
      ],
      [
        {
          _id: 'heavy-use',
          ruleIdentity: 'feat/heavy-use',
          modifiers: [],
          detail: { kind: 'feat' },
          grants: [{ catalogEntryId: 'heavy-training' }],
          proficiencyPrerequisites: [
            { kind: 'proficiency', proficiency: { category: 'heavy' } },
          ],
        },
        {
          _id: 'heavy-training',
          ruleIdentity: 'feature/heavy-training',
          modifiers: [],
          detail: { kind: 'classFeature' },
          proficiencies: [{ category: 'heavy' }],
        },
      ],
    ),
  );
  expect(result.proficiencyPrerequisites.map((check) => check.met)).toEqual([
    true,
    false,
  ]);
});

test('a granted entry is checked at its source choice position', () => {
  const result = calculateCharacterSheet(
    sheet(
      [feat('training-choice', { level: 'level-1', order: 0 })],
      [
        {
          _id: 'training-choice',
          ruleIdentity: 'feat/training-choice',
          modifiers: [],
          detail: { kind: 'feat' },
          grants: [{ catalogEntryId: 'heavy-use' }],
        },
        {
          _id: 'heavy-use',
          ruleIdentity: 'feature/heavy-use',
          modifiers: [],
          detail: { kind: 'classFeature' },
          proficiencies: [{ category: 'heavy' }],
          proficiencyPrerequisites: [
            { kind: 'proficiency', proficiency: { category: 'heavy' } },
          ],
        },
      ],
    ),
  );
  expect(
    result.proficiencyPrerequisites.map((check) => [check.view, check.met]),
  ).toEqual([
    ['current', true],
    ['recorded', false],
  ]);
});

test('prestige entry is checked before first-level benefits and only on its first level', () => {
  const input = sheet(
    [level(2, 'prestige'), level(3, 'prestige')],
    [
      {
        _id: 'prestige',
        ruleIdentity: 'class/prestige',
        modifiers: [],
        proficiencies: [{ category: 'heavy' }],
        proficiencyPrerequisites: [
          { kind: 'proficiency', proficiency: { category: 'heavy' } },
        ],
        detail: {
          kind: 'class',
          classKind: 'prestige',
          hitDie: 10,
          bab: 'full',
          saves: { fort: 'good', ref: 'poor', will: 'poor' },
          skillRanksPerLevel: 2,
        },
      },
    ],
  );
  expect(calculateCharacterSheet(input).proficiencyPrerequisites).toEqual([
    {
      entryId: 'level-2',
      view: 'current',
      proficiency: { category: 'heavy' },
      met: true,
    },
    {
      entryId: 'level-2',
      view: 'recorded',
      proficiency: { category: 'heavy' },
      met: false,
    },
  ]);
});

test('current equipment remains available to recorded checks despite a later gained level', () => {
  const result = calculateCharacterSheet(
    sheet(
      [
        feat('heavy-use', { level: 'level-1', order: 0 }),
        level(2),
        {
          _id: 'training-item',
          kind: 'item',
          active: true,
          catalogEntryId: 'training-item',
          gainedAtClassLevel: 'level-2',
          state: { kind: 'item', enhancement: 0 },
        },
      ],
      [
        {
          _id: 'heavy-use',
          ruleIdentity: 'feat/heavy-use',
          modifiers: [],
          detail: { kind: 'feat' },
          proficiencyPrerequisites: [
            { kind: 'proficiency', proficiency: { category: 'heavy' } },
          ],
        },
        {
          _id: 'training-item',
          ruleIdentity: 'item/training-item',
          modifiers: [],
          detail: { kind: 'item' },
          proficiencies: [{ category: 'heavy' }],
        },
      ],
    ),
  );
  expect(result.proficiencyPrerequisites.map((check) => check.met)).toEqual([
    true,
    true,
  ]);
});

test('automatic class grants share the class level position without satisfying their own requirement', () => {
  const input = sheet(
    [],
    [
      {
        _id: 'heavy-training',
        ruleIdentity: 'feature/heavy-training',
        modifiers: [],
        detail: { kind: 'classFeature' },
        proficiencies: [{ category: 'heavy' }],
        proficiencyPrerequisites: [
          { kind: 'proficiency', proficiency: { category: 'heavy' } },
        ],
      },
    ],
  );
  input.catalogEntries = input.catalogEntries.map((definition) =>
    definition._id === 'fighter' && definition.detail?.kind === 'class'
      ? {
          ...definition,
          detail: {
            ...definition.detail,
            featuresByLevel: [
              { classLevel: 1, catalogEntryId: 'heavy-training' },
            ],
          },
        }
      : definition,
  );
  expect(
    calculateCharacterSheet(input).proficiencyPrerequisites.map((check) => [
      check.view,
      check.met,
    ]),
  ).toEqual([
    ['current', true],
    ['recorded', false],
  ]);
});

test.each([undefined, 'deleted-level'])(
  'a choice linked to %s has current checking only',
  (gainedAtClassLevel) => {
    const result = calculateCharacterSheet(
      sheet(
        [feat('heavy-use', { level: gainedAtClassLevel })],
        [
          {
            _id: 'heavy-use',
            ruleIdentity: 'feat/heavy-use',
            modifiers: [],
            detail: { kind: 'feat' },
            proficiencyPrerequisites: [
              { kind: 'proficiency', proficiency: { category: 'heavy' } },
            ],
          },
        ],
      ),
    );
    expect(
      result.proficiencyPrerequisites.map((check) => [check.view, check.met]),
    ).toEqual([['current', false]]);
  },
);

test('current manual additions and removals also apply to recorded proficiency checks', () => {
  const input = sheet(
    [feat('heavy-use', { level: 'level-1', order: 0 })],
    [
      {
        _id: 'heavy-use',
        ruleIdentity: 'feat/heavy-use',
        modifiers: [],
        detail: { kind: 'feat' },
        proficiencyPrerequisites: [
          { kind: 'proficiency', proficiency: { category: 'heavy' } },
        ],
      },
    ],
  );
  input.entries = input.entries.map((entry) =>
    entry.kind === 'base'
      ? {
          ...entry,
          state: {
            ...entry.state,
            proficiencies: { added: [{ category: 'heavy' }], removed: [] },
          },
        }
      : entry,
  );
  expect(
    calculateCharacterSheet(input).proficiencyPrerequisites.map(
      (check) => check.met,
    ),
  ).toEqual([true, true]);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'base'
      ? {
          ...entry,
          state: {
            ...entry.state,
            proficiencies: {
              added: [{ category: 'heavy' }],
              removed: [{ category: 'heavy' }],
            },
          },
        }
      : entry,
  );
  expect(
    calculateCharacterSheet(input).proficiencyPrerequisites.map(
      (check) => check.met,
    ),
  ).toEqual([false, false]);
});

test('a dormant selection is invisible to prerequisites and a kept one is checked', () => {
  const input = sheet(
    [
      {
        ...feat('heavy-use', { level: 'level-1', order: 0 }),
        selectionSource: {
          kind: 'slot',
          grantedBy: { kind: 'entry', entryId: 'missing-source' },
        },
      },
    ],
    [
      {
        _id: 'heavy-use',
        ruleIdentity: 'feat/heavy-use',
        modifiers: [],
        detail: { kind: 'feat' },
        proficiencyPrerequisites: [
          { kind: 'proficiency', proficiency: { category: 'heavy' } },
        ],
      },
    ],
  );
  expect(calculateCharacterSheet(input).proficiencyPrerequisites).toEqual([]);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'feat' ? { ...entry, kept: true } : entry,
  );
  expect(
    calculateCharacterSheet(input).proficiencyPrerequisites.map((check) => [
      check.view,
      check.met,
    ]),
  ).toEqual([
    ['current', false],
    ['recorded', false],
  ]);
});

test('without recorded choice orders, a same-level peer cannot supply a proficiency', () => {
  const result = calculateCharacterSheet(
    sheet(
      [
        feat('heavy-use', { level: 'level-1' }),
        feat('heavy-training', { level: 'level-1' }),
      ],
      [
        {
          _id: 'heavy-use',
          ruleIdentity: 'feat/heavy-use',
          modifiers: [],
          detail: { kind: 'feat' },
          proficiencyPrerequisites: [
            { kind: 'proficiency', proficiency: { category: 'heavy' } },
          ],
        },
        {
          _id: 'heavy-training',
          ruleIdentity: 'feat/heavy-training',
          modifiers: [],
          detail: { kind: 'feat' },
          proficiencies: [{ category: 'heavy' }],
        },
      ],
    ),
  );
  expect(result.proficiencyPrerequisites.map((check) => check.met)).toEqual([
    true,
    false,
  ]);
});
