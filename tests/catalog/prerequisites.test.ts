// @vitest-environment node
import { expect, test } from 'vitest';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { mapEntry } from '../../scripts/catalog/map';
import type { LoadedRecord } from '../../scripts/catalog/records';
import { calculateCharacterSheet } from '../../src/lib/character-sheet';
import {
  prerequisiteSheet,
  selectedFeat,
} from '../../src/lib/character-sheet-prerequisite-fixture';

function source(
  id: string,
  name: string,
  type: string,
  description = '',
  repo: LoadedRecord['repo'] = 'pf1',
): LoadedRecord {
  return {
    repo,
    pack: type === 'race' ? 'races' : 'feats',
    path: `${id}.yaml`,
    record: {
      _id: id,
      _key: `!items!${id}`,
      name,
      type,
      system: { description: { value: description } },
    },
  };
}
test('import mapping parses reliable typed prerequisites, resolves UUID before exact names and retains unparsed prose', () => {
  const strength = source('Power', 'Power Attack', 'feat');
  const elf = source('Elf', 'Elf', 'race');
  const target = source(
    'Target',
    'Test feat',
    'feat',
    '<p><strong>Prerequisites</strong>: Str 13, base attack bonus +1, @UUID[Compendium.pf1.feats.Power]{Power Attack}, Climb 2 ranks, elf or special training.</p><p><strong>Benefit</strong>: test.</p>',
  );
  const lookup = new Map(
    [strength, elf, target].map((record) => [
      `${record.repo}/${record.record._id}`,
      record,
    ]),
  );
  const entry = mapEntry({
    source: target,
    kind: 'feat',
    lookup,
    resolveKey: (key) => (lookup.has(key) ? key : undefined),
    spellClassTags: new Set(),
  });
  expect(entry.prerequisites).toEqual([
    { kind: 'ability', ability: 'strength', min: 13 },
    { kind: 'bab', bab: 1 },
    { kind: 'feat', feat: 'pf1/Power' },
    { kind: 'skillRanks', skillRanks: 'skill.clm', min: 2 },
    { kind: 'unchecked', unchecked: 'elf or special training' },
  ]);
  expect(entry.prerequisiteText).toContain('Str 13');
  expect(entry.description).toContain('special training');
});

test('UUID labels containing or stay one clause and unlabelled links remain readable', () => {
  const prerequisite = source('Either', 'Sword or Spell', 'feat');
  const target = source(
    'Target',
    'Test feat',
    'feat',
    '<i>Introduction.</i><p><strong>Prerequisites</strong>: @UUID[Compendium.pf1.feats.Either]{Sword or Spell}, @UUID[Compendium.pf1.feats.Either], @UUID[Compendium.pf1.feats.Missing].</p>',
  );
  const lookup = new Map(
    [prerequisite, target].map((record) => [
      `${record.repo}/${record.record._id}`,
      record,
    ]),
  );
  const entry = mapEntry({
    source: target,
    kind: 'feat',
    lookup,
    resolveKey: (key) => (lookup.has(key) ? key : undefined),
    spellClassTags: new Set(),
  });
  expect(entry.prerequisites).toEqual([
    { kind: 'feat', feat: 'pf1/Either' },
    { kind: 'feat', feat: 'pf1/Either' },
    { kind: 'unchecked', unchecked: 'Unresolved reference' },
  ]);
  expect(entry.prerequisiteText).toBe(
    'Sword or Spell, Sword or Spell, Unresolved reference',
  );
});

test('linked class feature prerequisites retain their owning class identity from class associations', () => {
  const feature = source('Rage', 'Rage', 'feat');
  feature.pack = 'class-abilities';
  const barbarian = source('Barbarian', 'Unrelated display name', 'class');
  barbarian.record.system.links = {
    classAssociations: [
      { level: 1, uuid: 'Compendium.pf1.class-abilities.Rage' },
    ],
  };
  const target = source(
    'Target',
    'Test feat',
    'feat',
    '<p>Prerequisites: @UUID[Compendium.pf1.class-abilities.Rage].</p>',
  );
  const lookup = new Map(
    [feature, barbarian, target].map((record) => [
      `pf1/${record.record._id}`,
      record,
    ]),
  );
  const entry = mapEntry({
    source: target,
    kind: 'feat',
    lookup,
    resolveKey: (key) => (lookup.has(key) ? key : undefined),
    spellClassTags: new Set(),
  });
  expect(entry.prerequisites).toEqual([
    {
      kind: 'classFeature',
      classFeature: 'pf1/Rage',
      classFeatureName: 'Rage',
      classFeatureClass: 'pf1/Barbarian',
    },
  ]);
  expect(importedCatalogEntrySchema.parse(entry).prerequisites).toEqual(
    entry.prerequisites,
  );
});

test('linked proficiency feats use their resolved rule name and class grants satisfy their requirements', () => {
  const martial = source('Martial', 'Martial Weapon Proficiency', 'feat');
  const target = source(
    'Target',
    'Test feat',
    'feat',
    '<p>Prerequisites: @UUID[Compendium.pf1.feats.Martial]{Different label}.</p>',
  );
  const lookup = new Map(
    [martial, target].map((record) => [`pf1/${record.record._id}`, record]),
  );
  const entry = mapEntry({
    source: target,
    kind: 'feat',
    lookup,
    resolveKey: (key) => (lookup.has(key) ? key : undefined),
    spellClassTags: new Set(),
  });
  expect(entry.prerequisites).toEqual([
    { kind: 'proficiency', proficiency: { category: 'martial' } },
  ]);
  const input = prerequisiteSheet(
    [selectedFeat('target')],
    [
      {
        _id: 'target',
        ruleIdentity: 'feat/target',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: entry.prerequisites,
      },
    ],
  );
  input.catalogEntries = input.catalogEntries.map((definition) =>
    definition._id === 'fighter'
      ? { ...definition, proficiencies: [{ category: 'martial' }] }
      : definition,
  );
  expect(
    calculateCharacterSheet(input).prerequisites.map(({ met }) => met),
  ).toEqual([true, true]);
});

test.each([
  ['Simple Weapon Proficiency', 'simple'],
  ['Light Armor Proficiency', 'light'],
  ['Medium Armor Proficiency', 'medium'],
  ['Heavy Armor Proficiency', 'heavy'],
  ['Armor Proficiency (Heavy)', 'heavy'],
  ['Shield Proficiency', 'shield'],
  ['Tower Shield Proficiency', 'towerShield'],
])(
  'recognized proficiency names and their links share category semantics: %s',
  (name, category) => {
    const proficiency = source('Proficiency', name, 'feat');
    const target = source(
      'Target',
      'Test feat',
      'feat',
      `<p>Prerequisites: ${name}, @UUID[Compendium.pf1.feats.Proficiency].</p>`,
    );
    const lookup = new Map(
      [proficiency, target].map((record) => [
        `pf1/${record.record._id}`,
        record,
      ]),
    );
    expect(
      mapEntry({
        source: target,
        kind: 'feat',
        lookup,
        resolveKey: (key) => (lookup.has(key) ? key : undefined),
        spellClassTags: new Set(),
      }).prerequisites,
    ).toEqual([
      { kind: 'proficiency', proficiency: { category } },
      { kind: 'proficiency', proficiency: { category } },
    ]);
  },
);

test.each([
  'Exotic Weapon Proficiency (bastard sword)',
  '@UUID[Compendium.pf1.feats.Exotic]{Exotic Weapon Proficiency} (bastard sword)',
])(
  'a chosen exotic proficiency imports a base weapon requirement: %s',
  (text) => {
    const exotic = source('Exotic', 'Exotic Weapon Proficiency', 'feat');
    const target = source(
      'Target',
      'Test feat',
      'feat',
      `<p>Prerequisites: ${text}.</p>`,
    );
    const lookup = new Map(
      [exotic, target].map((record) => [`pf1/${record.record._id}`, record]),
    );
    expect(
      mapEntry({
        source: target,
        kind: 'feat',
        lookup,
        resolveKey: (key) => (lookup.has(key) ? key : undefined),
        spellClassTags: new Set(),
      }).prerequisites,
    ).toEqual([
      { kind: 'proficiency', proficiency: { baseType: 'bastard sword' } },
    ]);
  },
);

test('proficiency text without a reliable category or single weapon remains original readable prose', () => {
  const target = source(
    'Target',
    'Test feat',
    'feat',
    '<p>Prerequisites: Exotic Weapon Proficiency, Martial Weapon Proficiency (longsword or shortbow), proficiency with oversized weapons.</p>',
  );
  const lookup = new Map([['pf1/Target', target]]);
  expect(
    mapEntry({
      source: target,
      kind: 'feat',
      lookup,
      resolveKey: (key) => (lookup.has(key) ? key : undefined),
      spellClassTags: new Set(),
    }).prerequisites,
  ).toEqual([
    { kind: 'unchecked', unchecked: 'Exotic Weapon Proficiency' },
    {
      kind: 'unchecked',
      unchecked: 'Martial Weapon Proficiency (longsword or shortbow)',
    },
    { kind: 'unchecked', unchecked: 'proficiency with oversized weapons' },
  ]);
});

test('ordinal levels and alignment sets import only their unambiguous requirements', () => {
  const fighter = source('Fighter', 'Fighter', 'class');
  const target = source(
    'Ordinal',
    'Test feat',
    'feat',
    '<p>Prerequisites: fighter level 4th, 4th-level fighter, 4th-level, any chaotic, any good, fighter-like training, 4th-level stranger.</p>',
  );
  const lookup = new Map(
    [fighter, target].map((record) => [`pf1/${record.record._id}`, record]),
  );
  expect(
    mapEntry({
      source: target,
      kind: 'feat',
      lookup,
      resolveKey: (key) => (lookup.has(key) ? key : undefined),
      spellClassTags: new Set(),
    }).prerequisites,
  ).toEqual([
    { kind: 'classLevel', classLevel: 'pf1/Fighter', min: 4 },
    { kind: 'classLevel', classLevel: 'pf1/Fighter', min: 4 },
    { kind: 'characterLevel', characterLevel: 4 },
    { kind: 'alignment', alignment: ['CG', 'CN', 'CE'] },
    { kind: 'alignment', alignment: ['LG', 'NG', 'CG'] },
    { kind: 'unchecked', unchecked: 'fighter-like training' },
    { kind: 'unchecked', unchecked: '4th-level stranger' },
  ]);
});

test('Requirements headings identify a reviewed deity name and leave arbitrary names readable', () => {
  const target = source(
    'Religion',
    'Test trait',
    'feat',
    '<p>Requirements: Iomedae, Silver Covenant.</p>',
  );
  const lookup = new Map([['pf1/Religion', target]]);
  expect(
    mapEntry({
      source: target,
      kind: 'trait',
      lookup,
      resolveKey: (key) => key,
      spellClassTags: new Set(),
    }).prerequisites,
  ).toEqual([
    { kind: 'deity', deity: 'Iomedae' },
    { kind: 'unchecked', unchecked: 'Silver Covenant' },
  ]);
  target.record.system.description = {
    value: '<p>Prerequisites: Iomedae.</p>',
  };
  expect(
    mapEntry({
      source: target,
      kind: 'feat',
      lookup,
      resolveKey: (key) => key,
      spellClassTags: new Set(),
    }).prerequisites,
  ).toEqual([{ kind: 'unchecked', unchecked: 'Iomedae' }]);
});

test('worship requirements parse reviewed literal deities and retain nonliteral or unreviewed prose', () => {
  const target = source(
    'Worship',
    'Test feat',
    'feat',
    '<p>Prerequisites: worshiper of Iomedae, worshipper of one of the good gods, worshiper of a deity who grants the War domain, worshiper of Silver Covenant.</p>',
  );
  expect(
    mapEntry({
      source: target,
      kind: 'feat',
      lookup: new Map(),
      resolveKey: (key) => key,
      spellClassTags: new Set(),
    }).prerequisites,
  ).toEqual([
    { kind: 'deity', deity: 'Iomedae' },
    { kind: 'unchecked', unchecked: 'worshipper of one of the good gods' },
    {
      kind: 'unchecked',
      unchecked: 'worshiper of a deity who grants the War domain',
    },
    { kind: 'unchecked', unchecked: 'worshiper of Silver Covenant' },
  ]);
});

test('Additional Traits uses the typed import rule for its marker and two trait slots', () => {
  const target = source('Additional', 'Additional Traits', 'feat');
  const lookup = new Map([['pf1/Additional', target]]);
  const imported = mapEntry({
    source: target,
    kind: 'feat',
    lookup,
    resolveKey: (key) => key,
    spellClassTags: new Set(),
  });
  expect(imported).toMatchObject({
    detail: { kind: 'feat', additionalTraits: true, repeatable: 'unreviewed' },
    grantsSlots: [{ kind: 'trait', count: 2 }],
  });
  target.record.name = 'Additional Traits Variant';
  const variant = mapEntry({
    source: target,
    kind: 'feat',
    lookup,
    resolveKey: (key) => key,
    spellClassTags: new Set(),
  });
  expect(variant.detail).not.toHaveProperty('additionalTraits');
  expect(variant).not.toHaveProperty('grantsSlots');
});

test('catalog bodies accept legacy and tagged prerequisite atoms but reject invalid tags and alignments', () => {
  const target = source('Schema', 'Test feat', 'feat');
  const body = mapEntry({
    source: target,
    kind: 'feat',
    lookup: new Map(),
    resolveKey: (key) => key,
    spellClassTags: new Set(),
  });
  for (const prerequisites of [
    [
      { ability: 'strength', min: 13 },
      { anyOf: [{ alignment: ['LG'] }, { deity: 'Iomedae' }] },
    ],
    [
      { kind: 'ability', ability: 'strength', min: 13 },
      {
        anyOf: [
          { kind: 'alignment', alignment: ['LG'] },
          { kind: 'deity', deity: 'Iomedae' },
        ],
      },
    ],
  ])
    expect(
      importedCatalogEntrySchema.parse({ ...body, prerequisites })
        .prerequisites,
    ).toEqual(prerequisites);
  expect(
    importedCatalogEntrySchema.safeParse({
      ...body,
      prerequisites: [{ kind: 'bab', ability: 'strength', min: 13 }],
    }).success,
  ).toBe(false);
  expect(
    importedCatalogEntrySchema.safeParse({
      ...body,
      prerequisites: [{ kind: 'alignment', alignment: ['unknown'] }],
    }).success,
  ).toBe(false);
});
