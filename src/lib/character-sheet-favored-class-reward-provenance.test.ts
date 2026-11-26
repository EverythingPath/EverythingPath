// @vitest-environment edge-runtime
// rotation-7 fix r2 and r3 (root, 2026-11-22): `@favoredClassReward.<id>`
// resolves only in a rule value of a definition stored with `scope:
// 'global'` that is not a Catalog Copy (`hasReviewedRuleValues`). Every other
// place a formula can be saved keeps the result it had before the count
// existed: an unsupported variable, with its warning.
//
// Fix r3 and r4: the guard is a regression aid for that predicate. Its
// tables name
// - every table whose stored documents hold a formula, with the full path of
//   each formula place in it (`formulaTables`), found by walking
//   `convex/schema.ts`, and every untyped field (`v.any()`) the walk meets,
//   with what it holds (`untypedFields`);
// - every definition kind (`definitionKinds`), with the formula places the
//   schema gives it (a Modifier's value on every kind but the base scores,
//   each rule-value kind's amount on every kind) and whether the sheet
//   evaluates them;
// - every Sheet Entry kind (`sheetEntryKinds`) and the definitions it
//   reaches: its own, a Class Level's class, an item's Item Abilities;
// - every rule-value kind (`ruleValuePlaces`), from `ruleValueSchema`, and
//   that its amount is its only field taking a formula.
// The first tests fail when the schema gains a formula path, an untyped
// field, a kind or a table these do not name, and every stored fixture must
// pass its stored validator. Each case then sets up its source
// eligible and active (a Racial Trait of the active race, an Archetype of
// the character's class, an Item Ability on an item, a Class Level's
// class, the base scores) and proves its place live: a supported formula
// there gives its number, or, where the sheet evaluates nothing, changes
// nothing. With no reward chosen, the variable's result equals that of a
// variable no version of the sheet supports (the base's result: no number,
// its warning) everywhere but a rule value of a catalog definition, which
// reads the count: 0. A retirement's retained body, inside a listed untyped
// field, runs through `candidateDefinition` before the calculator (below).
import { v, type GenericValidator } from 'convex/values';
import { convexTest } from 'convex-test';
import { validate } from 'convex-helpers/validators';
import { describe, expect, test } from 'vitest';
import schema, {
  catalogEntryValidator,
  characterSheetEntryValidator,
} from '../../convex/schema';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  ruleValueSchema,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type RuleValue,
  type SheetEntry,
} from './character-sheet';
import type { Doc } from '../../convex/_generated/dataModel';
import { candidateDefinition } from '../../convex/lib/catalogCandidateDefinition';
import { catalogRuntimeCompatibility } from './catalog/runtime-compatibility';
import { getConditionDefinition } from './character-sheet-conditions';
import { createCatalogSheetEntryState } from './character-sheet-entries';

const variable = '@favoredClassReward.bomb';
const neverSupported = '@neverSupportedProbe.bomb';
/** A supported variable: the base scores give Strength 14, so it gives 5. */
const control = '3 + @ability.str.mod';

type DefinitionKind = NonNullable<CharacterSheetCatalogEntry['detail']>['kind'];
type RuleValueKind = RuleValue['kind'];
type Place = 'modifier' | RuleValueKind;
type Sheet = ReturnType<typeof calculateCharacterSheet>;
type Amount = { formula: string };

const receiverKey = 'guard_received';
const receiverDiceKey = 'guard_received_dice';

/**
 * Each rule-value kind as a case stores it, and where its number shows: the
 * entry's own number, or the receiver's 2 per-day uses or 1 die raised by it.
 */
const ruleValuePlaces = {
  dice: {
    store: (amount: Amount) => ({ kind: 'dice', die: 6, amount, key: 'guard' }),
    read: (sheet: Sheet, row: string) =>
      sheet.featureNumbers.find((number) => number.entryId === row)?.count,
    shows: (amount: number) => amount,
  },
  diceIncrease: {
    store: (amount: Amount) => ({
      kind: 'diceIncrease',
      key: receiverDiceKey,
      amount,
    }),
    read: (sheet: Sheet) =>
      sheet.featureNumbers.find((number) => number.entryId === 'receiver-row')
        ?.count,
    shows: (amount: number) => 1 + amount,
  },
  dailyMaximum: {
    store: (amount: Amount) => ({
      kind: 'dailyMaximum',
      key: 'guard',
      unit: 'uses',
      amount,
    }),
    read: (sheet: Sheet) =>
      sheet.dailyMaxima.find((maximum) => maximum.key === 'guard')?.value,
    shows: (amount: number) => amount,
  },
  dailyMaximumIncrease: {
    store: (amount: Amount) => ({
      kind: 'dailyMaximumIncrease',
      key: receiverKey,
      amount,
    }),
    read: (sheet: Sheet) =>
      sheet.dailyMaxima.find((maximum) => maximum.key === receiverKey)?.value,
    shows: (amount: number) => 2 + amount,
  },
  damageReduction: {
    store: (amount: Amount) => ({
      kind: 'damageReduction',
      amount,
      bypass: '-',
    }),
    read: (sheet: Sheet, row: string) =>
      sheet.damageReduction.lines.find((line) => line.entryId === row)?.value,
    shows: (amount: number) => amount,
  },
  spellResistance: {
    store: (amount: Amount) => ({ kind: 'spellResistance', amount }),
    read: (sheet: Sheet, row: string) =>
      sheet.spellResistanceStatistic.lines.find((line) => line.entryId === row)
        ?.value,
    shows: (amount: number) => amount,
  },
} satisfies Record<
  RuleValueKind,
  {
    store: (amount: Amount) => RuleValue;
    read: (sheet: Sheet, row: string) => number | null | undefined;
    shows: (amount: number) => number;
  }
>;
const ruleValueKinds = Object.keys(ruleValuePlaces) as RuleValueKind[];

const bardDetail = {
  kind: 'class',
  classKind: 'base',
  hitDie: 8,
  bab: 'threeQuarters',
  saves: { fort: 'poor', ref: 'good', will: 'good' },
  skillRanksPerLevel: 6,
  classSkills: [],
  featuresByLevel: [],
  picksByLevel: [],
} as const;

/**
 * Every definition kind: how the sheet reaches it, the detail a case stores
 * (attached to the fixture's race and class), the row its numbers show on,
 * and whether the sheet evaluates its Modifiers' formulas (null: the schema
 * stores none) and its rule values'.
 */
const definitionKinds = {
  race: {
    via: 'the race Sheet Entry',
    detail: { kind: 'race', racialTraits: [] },
    row: 'race-row',
    modifiers: true,
    ruleValues: true,
  },
  racialTrait: {
    via: 'a Racial Trait of the active race',
    detail: { kind: 'racialTrait', raceEntryIds: ['race'], replaces: [] },
    row: 'own-row',
    modifiers: true,
    ruleValues: true,
  },
  archetype: {
    via: 'an Archetype of the Bard the character has a level in',
    detail: {
      kind: 'archetype',
      classEntryIds: ['bard'],
      replaces: [],
      adds: [],
    },
    row: 'own-row',
    modifiers: true,
    ruleValues: true,
  },
  classFeature: ownEntry({ kind: 'classFeature' }),
  feat: ownEntry({ kind: 'feat' }),
  trait: ownEntry({ kind: 'trait' }),
  spellEffect: ownEntry({
    kind: 'spellEffect',
    defaultCasterLevel: 1,
    lastsOverOneDay: false,
  }),
  condition: ownEntry({ kind: 'condition' }),
  item: ownEntry({ kind: 'item', consumable: false }),
  manual: ownEntry({ kind: 'manual' }),
  spell: {
    via: 'a Spell Sheet Entry, which the sheet does not evaluate',
    detail: { kind: 'spell' },
    row: 'own-row',
    modifiers: false,
    ruleValues: false,
  },
  base: {
    via: 'the base scores Sheet Entry',
    detail: { kind: 'base' },
    row: 'base-row',
    modifiers: null,
    ruleValues: true,
  },
  class: {
    via: "a Class Level; the sheet reads a class's Modifiers, not its rule values",
    detail: bardDetail,
    row: 'level-1',
    modifiers: true,
    ruleValues: false,
  },
  itemAbility: {
    via: 'an item listing it; the sheet reads its Modifiers, not its rule values',
    detail: { kind: 'itemAbility', appliesTo: 'armor', bonusEquivalent: 0 },
    row: 'item-row',
    modifiers: true,
    ruleValues: false,
  },
} as const satisfies Record<
  DefinitionKind,
  {
    via: string;
    detail: CharacterSheetCatalogEntry['detail'];
    row: string;
    modifiers: boolean | null;
    ruleValues: boolean;
  }
>;
function ownEntry<const Detail>(detail: Detail) {
  return {
    via: 'its own Sheet Entry',
    detail,
    row: 'own-row',
    modifiers: true,
    ruleValues: true,
  } as const;
}
const allKinds = Object.keys(definitionKinds) as DefinitionKind[];

/** Every Sheet Entry kind and the definition kinds it reaches. */
const sheetEntryKinds = {
  race: ['race'],
  racialTrait: ['racialTrait'],
  archetype: ['archetype'],
  classFeature: ['classFeature'],
  feat: ['feat'],
  trait: ['trait'],
  spellEffect: ['spellEffect'],
  condition: ['condition'],
  item: ['item', 'itemAbility'],
  spell: ['spell'],
  manual: ['manual'],
  base: ['base'],
  classLevel: ['class'],
  attackRoutine: [],
  abilityDamage: [],
  abilityDrain: [],
} as const satisfies Record<SheetEntry['kind'], readonly DefinitionKind[]>;

function formulaPaths(kind: DefinitionKind) {
  return [
    ...(definitionKinds[kind].modifiers === null ? [] : ['modifiers[].value']),
    ...ruleValueKinds.map((ruleValue) => `ruleValues[]<${ruleValue}>.amount`),
  ];
}

/** A stored definition's formula places, below `prefix`. */
const definitionPaths = (prefix: string) => [
  `${prefix}modifiers[].value`,
  ...ruleValueKinds.map((kind) => `${prefix}ruleValues[]<${kind}>.amount`),
];

/**
 * Every table whose documents hold a formula, how the sheet reads it, and
 * the full path of each formula place in it: a second definition on a row is
 * a path this does not list.
 */
const formulaTables = {
  catalogEntry: {
    reads: 'the definitions the sheet reads',
    paths: definitionPaths(''),
  },
  catalogReleaseRow: {
    reads:
      "a Catalog Release's definition bodies, read as its catalog definitions' (`candidateDefinition`)",
    paths: definitionPaths('<definition>.payload.'),
  },
  characterMoveDefinition: {
    reads:
      "a moved Character's definitions, stored again as its Catalog Copies (`characterCopyDefinition`)",
    paths: definitionPaths('definition.'),
  },
} satisfies Record<string, { reads: string; paths: string[] }>;

/**
 * Every untyped field (`v.any()`) in the stored schema, by table, and what it
 * holds. The walk cannot see a formula inside one, so each is listed here.
 */
const untypedFields: Record<string, Record<string, string>> = {
  catalogReleaseRow: {
    '<definition>.payload.unsupported[].value':
      'an upstream value the importer could not map; `candidateDefinition` copies none into a definition',
    '<resource>.payload':
      "a release's resource (an imported resource, the casting tables), compared for change and read as tables, never as a definition",
    '<legal>.payload': "a release's legal text",
    '<report>.payload':
      "a release's reports; a retirement's `lastUsableDefinition` is a definition body the sheet evaluates (`candidateDefinition`), so the retained-body cases below project it",
  },
  canonicalResolutionRecord: Object.fromEntries(
    ['baselinePlan', 'finalPlan', 'finalOutcome'].flatMap((part) =>
      ['{}[]', '{}{}'].map((rest) => [
        `record.${part}.data${rest}`,
        "a militia board record's resolution data (JSON by name), which the sheet never reads",
      ]),
    ),
  ),
  characterSheetEntry: {
    '<base>.state.companionProgression.skillRanks':
      "an animal companion's skill ranks, a number by skill",
    '<base>.state.companionProgression<eidolon>.skillRanks':
      "an eidolon's skill ranks, a number by skill",
    '<base>.state.companionProgression<eidolon>.classSkills':
      "an eidolon's chosen class skills, by name",
  },
};

type Tables = Record<string, { validator: GenericValidator }>;

/** Each table's formula paths, and its untyped fields, as the walk finds them. */
function found(tables: Tables, of: 'formula' | 'untyped') {
  return Object.fromEntries(
    Object.entries(tables).flatMap(([name, table]) => {
      const paths = unique(
        walk(table.validator).flatMap((path) =>
          path.startsWith('any:') === (of === 'untyped')
            ? [path.replace(/^any:/, '')]
            : [],
        ),
      );
      return paths.length ? [[name, paths]] : [];
    }),
  );
}

/** The formula paths found in `tables` that `formulaTables` does not list. */
function unlistedFormulaPaths(tables: Tables) {
  const listed: Record<string, readonly string[]> = Object.fromEntries(
    Object.entries(formulaTables).map(([name, { paths }]) => [name, paths]),
  );
  return Object.entries(found(tables, 'formula')).flatMap(([name, paths]) =>
    paths.filter((path) => !(listed[name] ?? []).includes(path)),
  );
}

/** The untyped fields found in `tables` that `untypedFields` does not list. */
function unlistedUntypedFields(tables: Tables) {
  return Object.entries(found(tables, 'untyped')).flatMap(([name, paths]) =>
    paths
      .filter((path) => !(path in (untypedFields[name] ?? {})))
      .map((path) => `${name}: ${path}`),
  );
}

/**
 * Each path below `validator` to an object with a `formula` field, and,
 * prefixed `any:`, to each untyped field.
 */
function walk(validator: GenericValidator, path = ''): string[] {
  switch (validator.kind) {
    case 'object':
      return [
        ...('formula' in validator.fields ? [path] : []),
        ...Object.entries(validator.fields).flatMap(([key, field]) =>
          walk(field, path ? `${path}.${key}` : key),
        ),
      ];
    case 'array':
      return walk(validator.element, `${path}[]`);
    case 'record':
      return walk(validator.value, `${path}{}`);
    case 'union':
      return validator.members.flatMap((member) => {
        const kind = member.kind === 'object' ? member.fields.kind : undefined;
        return walk(
          member,
          kind?.kind === 'literal' ? `${path}<${String(kind.value)}>` : path,
        );
      });
    case 'any':
      return [`any:${path}`];
    default:
      return [];
  }
}
const unique = (paths: readonly string[]) => [...new Set(paths)].sort();

const moveDefinition = schema.tables.characterMoveDefinition.validator;
/** The schema with a second definition snapshot on a move row. */
const withSecondSnapshot: Tables = {
  ...schema.tables,
  characterMoveDefinition: {
    validator:
      moveDefinition.kind === 'object'
        ? v.object({
            ...moveDefinition.fields,
            previousDefinition: moveDefinition.fields.definition,
          })
        : moveDefinition,
  },
};

describe('the matrix names every formula place the schema has', () => {
  test('every table whose documents hold a formula, by full path', () => {
    expect(found(schema.tables, 'formula')).toEqual(
      Object.fromEntries(
        Object.entries(formulaTables).map(([name, { paths }]) => [
          name,
          unique(paths),
        ]),
      ),
    );
    expect(unlistedFormulaPaths(schema.tables)).toEqual([]);
  });

  test('a second definition snapshot on a move row is a path it does not name', () => {
    expect(unlistedFormulaPaths(withSecondSnapshot)).toEqual(
      definitionPaths('previousDefinition.').sort(),
    );
  });

  test('every untyped field, each listed with what it holds', () => {
    expect(unlistedUntypedFields(schema.tables)).toEqual([]);
    expect(found(schema.tables, 'untyped')).toEqual(
      Object.fromEntries(
        Object.entries(untypedFields).map(([name, fields]) => [
          name,
          unique(Object.keys(fields)),
        ]),
      ),
    );
    expect(
      unlistedUntypedFields({
        ...schema.tables,
        extra: { validator: v.object({ payload: v.any() }) },
      }),
    ).toEqual(['extra: payload']);
  });

  test('every definition kind, with its formula places', () => {
    const byKind = new Map<string, string[]>();
    for (const member of catalogEntryValidator.members) {
      const detail = member.fields.detail;
      const kinds =
        detail.kind === 'union'
          ? detail.members.map((kind) => kind.fields.kind.value)
          : [detail.fields.kind.value];
      for (const kind of kinds)
        byKind.set(
          kind,
          unique([...(byKind.get(kind) ?? []), ...walk(member)]),
        );
    }
    expect(Object.fromEntries(byKind)).toEqual(
      Object.fromEntries(
        allKinds.map((kind) => [kind, unique(formulaPaths(kind))]),
      ),
    );
  });

  test('every Sheet Entry kind, and every definition kind is reached', () => {
    const kinds = characterSheetEntryValidator.members.map((member) => ({
      kind: member.fields.kind.value,
      own: 'catalogEntryId' in member.fields,
    }));
    expect(kinds.map(({ kind }) => kind).sort()).toEqual(
      Object.keys(sheetEntryKinds).sort(),
    );
    for (const { kind, own } of kinds)
      expect(own).toBe(
        (sheetEntryKinds[kind] as readonly string[]).includes(kind),
      );
    expect(unique(Object.values(sheetEntryKinds).flat())).toEqual(
      unique(allKinds),
    );
  });

  test('every rule-value kind, whose amount is its only formula', () => {
    expect(
      ruleValueSchema.options.map((option) => option.shape.kind.value).sort(),
    ).toEqual([...ruleValueKinds].sort());
    for (const option of ruleValueSchema.options)
      expect(
        Object.entries(option.shape).flatMap(([field, value]) =>
          value.safeParse({ formula: '1' }).success ? [field] : [],
        ),
      ).toEqual(['amount']);
  });
});

const dazzled = getConditionDefinition('dazzled');

/** A stored definition's provenance, by the fields its writer stores. */
type Provenance = {
  name: string;
  kinds: readonly DefinitionKind[];
  /** A catalog definition: its rule values read the count. */
  reviewed?: true;
  /** A core-rule Condition: its own Modifiers replace the stored ones. */
  modifiersReplaced?: true;
  fields: Partial<CharacterSheetCatalogEntry> & Record<string, unknown>;
};
const everyKindButBase = allKinds.filter((kind) => kind !== 'base');
const character = { scope: 'character', characterId: 'character' } as const;
const campaign = { scope: 'campaign', campaignId: 'campaign' } as const;
const copy = (copiedFrom: string) => ({
  copiedFrom,
  copiedFromFingerprint: 'fingerprint',
});
const provenances: readonly Provenance[] = [
  {
    name: 'a catalog definition (global, its stored body)',
    kinds: everyKindButBase.filter((kind) => kind !== 'manual'),
    reviewed: true,
    fields: { scope: 'global', ruleIdentity: 'fixture/reviewed' },
  },
  {
    name: 'a Catalog Copy for the Character (detach, a moved Character)',
    kinds: everyKindButBase,
    fields: {
      ...character,
      ...copy('reviewed-original'),
      ruleIdentity: 'fixture/reviewed',
    },
  },
  {
    name: 'a Catalog Copy for the campaign (customize for campaign)',
    kinds: everyKindButBase,
    fields: {
      ...campaign,
      campaignPreference: true,
      ...copy('reviewed-original'),
      ruleIdentity: 'fixture/reviewed',
    },
  },
  {
    name: 'a one-off',
    kinds: everyKindButBase,
    fields: { ...character, ruleIdentity: 'one-off:own' },
  },
  {
    name: 'a one-off saved to the campaign',
    kinds: everyKindButBase,
    fields: { ...campaign, ruleIdentity: 'one-off:own' },
  },
  {
    name: 'a Catalog Copy of a one-off saved to the campaign',
    kinds: everyKindButBase,
    fields: {
      ...character,
      ...copy('campaign-own'),
      ruleIdentity: 'one-off:campaign-own',
    },
  },
  {
    name: 'a one-off Condition saved as Dazzled',
    kinds: ['condition'],
    modifiersReplaced: true,
    fields: {
      ...character,
      ruleIdentity: 'one-off:own',
      name: dazzled.name,
      detail: { kind: 'condition', conditionKey: 'dazzled' },
    },
  },
  {
    name: 'a one-off Condition edited to the core-rule Dazzled',
    kinds: ['condition'],
    modifiersReplaced: true,
    fields: {
      ...character,
      ruleIdentity: dazzled.ruleIdentity,
      sourceKey: dazzled.ruleIdentity,
      name: dazzled.name,
      detail: { kind: 'condition', conditionKey: 'dazzled' },
    },
  },
  {
    name: 'a Personal Adjustment',
    kinds: ['manual'],
    fields: { ...character, ruleIdentity: 'manual:own' },
  },
  {
    name: 'a sheet entry',
    kinds: ['condition', 'item', 'spell', 'spellEffect'],
    fields: { ...character, ruleIdentity: 'sheetEntry:own' },
  },
  {
    name: 'a Spell the sheet installs for a Character (spellCatalogInstall)',
    kinds: ['spell'],
    fields: {
      ...character,
      importedSpell: true,
      ruleIdentity: 'fixture/spell',
    },
  },
  {
    name: "the Character's base scores (created with the sheet)",
    kinds: ['base'],
    fields: { ...character, ruleIdentity: 'base:character' },
  },
];

/** The fields every stored definition has. */
const storedFields = { stacksWithItself: false, sources: [] };

const baseScores = abilityKeys.map((ability) => ({
  target: abilityTargets[ability],
  bonusType: 'base' as const,
  value: ability === 'strength' ? 14 : 10,
}));

function formulaFields(place: Place, formula?: string) {
  if (formula === undefined) return {};
  const amount = { formula };
  return place === 'modifier'
    ? {
        modifiers: [
          { target: 'init', bonusType: 'untyped', value: amount },
        ] as CharacterSheetCatalogEntry['modifiers'],
      }
    : { ruleValues: [ruleValuePlaces[place].store(amount)] };
}

type Case = { provenance: Provenance; kind: DefinitionKind; place: Place };

/** The rows that reach the case's definition, `own`. */
function ownRows(kind: DefinitionKind): SheetEntry[] {
  switch (kind) {
    case 'race':
    case 'base':
    case 'class':
      return [];
    case 'itemAbility':
      return [
        {
          _id: 'item-row',
          active: true,
          catalogEntryId: 'coat',
          kind: 'item',
          state: {
            ...createCatalogSheetEntryState({ kind: 'item' }).state,
            abilities: [{ catalogEntryId: 'own' }],
          },
        } as SheetEntry,
      ];
    case 'archetype':
      return [
        {
          _id: 'own-row',
          active: true,
          catalogEntryId: 'own',
          kind: 'archetype',
          state: { kind: 'archetype', classEntryId: 'bard' },
        },
      ];
    default:
      return [
        {
          _id: 'own-row',
          active: true,
          catalogEntryId: 'own',
          ...createCatalogSheetEntryState({ kind }),
        } as SheetEntry,
      ];
  }
}

/** The shared rows, each pointing at `own` when the case is that row's. */
function sharedRows(kind: DefinitionKind): SheetEntry[] {
  const id = (own: DefinitionKind, other: string) =>
    kind === own ? 'own' : other;
  return [
    {
      _id: 'base-row',
      kind: 'base',
      active: true,
      catalogEntryId: id('base', 'base'),
      state: { kind: 'base' },
    },
    {
      _id: 'race-row',
      kind: 'race',
      active: true,
      catalogEntryId: id('race', 'race'),
      state: { kind: 'race' },
    },
    {
      _id: 'level-1',
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: id('class', 'bard'),
        position: 1,
        hpGained: 8,
      },
    },
    {
      _id: 'receiver-row',
      active: true,
      catalogEntryId: 'receiver',
      ...createCatalogSheetEntryState({ kind: 'feat' }),
    } as SheetEntry,
  ];
}

const sharedDefinitions: readonly CharacterSheetCatalogEntry[] = [
  {
    _id: 'base',
    ...character,
    ruleIdentity: 'base:character',
    name: 'Base scores',
    ...storedFields,
    modifiers: baseScores,
    detail: { kind: 'base' },
  },
  {
    _id: 'race',
    scope: 'global',
    ruleIdentity: 'fixture/race',
    name: 'Race',
    ...storedFields,
    modifiers: [],
    detail: { kind: 'race', racialTraits: [] },
  },
  {
    _id: 'bard',
    scope: 'global',
    ruleIdentity: 'fixture/bard',
    name: 'Bard',
    ...storedFields,
    modifiers: [],
    detail: bardDetail,
  },
  // A catalog feat whose per-day maximum and dice the increases raise.
  {
    _id: 'receiver',
    scope: 'global',
    ruleIdentity: 'fixture/receiver',
    name: 'Receiver',
    ...storedFields,
    modifiers: [],
    detail: { kind: 'feat' },
    ruleValues: [
      { kind: 'dailyMaximum', key: receiverKey, unit: 'uses', amount: 2 },
      { kind: 'dice', die: 6, amount: 1, key: receiverDiceKey },
    ],
  },
  {
    _id: 'coat',
    scope: 'global',
    ruleIdentity: 'fixture/coat',
    name: 'Coat',
    ...storedFields,
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      armor: {
        slot: 'armor',
        category: 'light',
        bonus: 2,
        armorCheckPenalty: 0,
      },
    },
  },
];

/** The stored sheet of a case, with `formula` in its place (none if absent). */
function storedSheet(row: Case, formula?: string): CharacterSheetInput {
  const { provenance, kind, place } = row;
  return sheetWith(kind, {
    _id: 'own',
    name: 'Own entry',
    ...storedFields,
    detail: definitionKinds[kind].detail,
    modifiers: kind === 'base' ? baseScores : [],
    ...provenance.fields,
    ...formulaFields(place, formula),
  } as CharacterSheetCatalogEntry);
}

/** The sheet that reaches `own`, a definition of `kind`. */
function sheetWith(
  kind: DefinitionKind,
  own: CharacterSheetCatalogEntry,
): CharacterSheetInput {
  // The shared definition the case's own replaces, if any.
  const replaced: string | undefined = (
    { base: 'base', race: 'race', class: 'bard' } as Partial<
      Record<DefinitionKind, string>
    >
  )[kind];
  return {
    characterKind: 'pc',
    entries: [...sharedRows(kind), ...ownRows(kind)],
    catalogEntries: [
      ...sharedDefinitions.filter(({ _id }) => _id !== replaced),
      own,
    ],
  };
}

/** What the sheet shows: its numbers and every warning, `name` as the variable. */
function observe(input: CharacterSheetInput, name: string) {
  const sheet = calculateCharacterSheet(input);
  return JSON.parse(
    JSON.stringify({
      initiative: sheet.breakdowns.init.total,
      dailyMaxima: sheet.dailyMaxima,
      featureNumbers: sheet.featureNumbers,
      damageReduction: sheet.damageReduction,
      spellResistance: sheet.spellResistanceStatistic,
      warnings: sheet.warnings.map(
        ({ check, subject, message, fingerprint }) => ({
          check,
          subject,
          message,
          fingerprint,
        }),
      ),
    }).replaceAll(name, variable),
  ) as { warnings: { check: string; message: string }[] };
}

/** The number a case's formula gives at its place, if `amount` is its value. */
function read(row: Case, sheet: Sheet) {
  return row.place === 'modifier'
    ? sheet.breakdowns.init.total
    : ruleValuePlaces[row.place].read(sheet, definitionKinds[row.kind].row);
}
function shows(row: Case, amount: number) {
  return row.place === 'modifier'
    ? amount
    : ruleValuePlaces[row.place].shows(amount);
}
function evaluated({ provenance, kind, place }: Case) {
  const reach = definitionKinds[kind];
  return place === 'modifier'
    ? reach.modifiers === true && !provenance.modifiersReplaced
    : reach.ruleValues;
}
const readsCount = (row: Case) =>
  Boolean(row.provenance.reviewed) &&
  row.place !== 'modifier' &&
  evaluated(row);
const named = (row: Case) => ({ ...row, name: row.provenance.name });

const cases: Case[] = provenances.flatMap((provenance) =>
  provenance.kinds.flatMap((kind) =>
    (definitionKinds[kind].modifiers === null
      ? ruleValueKinds
      : (['modifier', ...ruleValueKinds] as Place[])
    ).map((place) => ({ provenance, kind, place })),
  ),
);

/**
 * Each stored document of the cases' sheets, once, whose shape its stored
 * validator refuses: the definitions by `catalogEntryValidator`, the Sheet
 * Entries by `characterSheetEntryValidator`. Validated without a database, so
 * a Convex ID (`v.id`) is checked as a string only, the fixtures' synthetic
 * IDs (`'character'`, `'bard'`) included.
 */
function invalidStored(inputs: readonly CharacterSheetInput[]) {
  const documents = new Map<
    string,
    [GenericValidator, { _id: string; [field: string]: unknown }]
  >();
  for (const input of inputs) {
    for (const definition of input.catalogEntries)
      documents.set(JSON.stringify(definition), [
        catalogEntryValidator,
        definition,
      ]);
    for (const entry of input.entries)
      // A Sheet Entry is stored with its Character, which the calculator's
      // input leaves out.
      documents.set(JSON.stringify(entry), [
        characterSheetEntryValidator,
        { characterId: 'character', ...entry },
      ]);
  }
  return [...documents.values()].flatMap(
    ([validator, { _id, ...document }]) => {
      try {
        validate(validator, document, { throw: true });
        return [];
      } catch (error) {
        return [
          `${_id}: ${error instanceof Error ? error.message : 'refused'}`,
        ];
      }
    },
  );
}

test('every stored fixture has the shape of its stored validator, with Convex IDs checked as strings', () => {
  expect(invalidStored(cases.map((row) => storedSheet(row, control)))).toEqual(
    [],
  );
});

test('a modern Class detail without its class skills, features and choices is refused', () => {
  const {
    classSkills: _classSkills,
    featuresByLevel: _featuresByLevel,
    picksByLevel: _picksByLevel,
    ...withoutLists
  } = bardDetail;
  expect(
    invalidStored([
      {
        characterKind: 'pc',
        entries: [],
        catalogEntries: [
          {
            ...sharedDefinitions.find(({ _id }) => _id === 'bard'),
            _id: 'bard',
            detail: withoutLists,
          } as CharacterSheetCatalogEntry,
        ],
      },
    ]),
  ).toHaveLength(1);
});

describe('each case is a live place', () => {
  test.each(cases.filter(evaluated).map(named))(
    '$name ($kind), $place: a supported formula gives its number',
    (row) => {
      const sheet = calculateCharacterSheet(storedSheet(row, control));
      expect(read(row, sheet)).toBe(shows(row, 5));
      expect(
        sheet.warnings.filter(({ check }) => check === 'unsupportedFormula'),
      ).toEqual([]);
    },
  );

  test.each(cases.filter((row) => !evaluated(row)).map(named))(
    '$name ($kind), $place: the sheet evaluates no formula here',
    (row) => {
      expect(observe(storedSheet(row, control), control)).toEqual(
        observe(storedSheet(row), control),
      );
    },
  );
});

describe('a formula naming @favoredClassReward with no reward chosen', () => {
  test.each(cases.filter((row) => !readsCount(row)).map(named))(
    '$name ($kind), $place: as before the count existed',
    (row) => {
      const result = observe(storedSheet(row, `3 + ${variable}`), variable);
      expect(result).toEqual(
        observe(storedSheet(row, `3 + ${neverSupported}`), neverSupported),
      );
      if (evaluated(row))
        expect(result.warnings.map(({ message }) => message)).toContainEqual(
          expect.stringContaining(`${variable} is not a supported variable.`),
        );
      // Not evaluated: as if no formula were saved there, with no warning.
      else expect(result).toEqual(observe(storedSheet(row), variable));
    },
  );

  // The one exception, and why the oracle is not empty: a catalog
  // definition's rule value reads the count, 0 with no reward chosen.
  test.each(cases.filter(readsCount).map(named))(
    '$name ($kind), $place: reads the count',
    (row) => {
      const input = storedSheet(row, `3 + ${variable}`);
      expect(read(row, calculateCharacterSheet(input))).toBe(shows(row, 3));
      expect(
        observe(input, variable).warnings.filter(({ message }) =>
          message.includes(variable),
        ),
      ).toEqual([]);
    },
  );
});

const provenance = (name: string) => {
  const found = provenances.find((row) => row.name === name);
  if (!found) throw new Error(`No provenance ${name}`);
  return found;
};
const unsupported = `${variable} is not a supported variable.`;

describe('the reviewers’ cases keep the base’s number and warning', () => {
  test.each([
    {
      kind: 'racialTrait',
      name: 'a one-off',
      what: 'an attached one-off Racial Trait',
    },
    {
      kind: 'archetype',
      name: 'a one-off',
      what: 'an applicable one-off Archetype',
    },
    {
      kind: 'base',
      name: "the Character's base scores (created with the sheet)",
      what: 'the base scores',
    },
  ] as const)(
    '$what: its per-day maximum gives no number',
    ({ kind, name }) => {
      const row: Case = {
        provenance: provenance(name),
        kind,
        place: 'dailyMaximum',
      };
      expect(
        read(row, calculateCharacterSheet(storedSheet(row, control))),
      ).toBe(5);
      const sheet = calculateCharacterSheet(
        storedSheet(row, `3 + ${variable}`),
      );
      expect({
        value: read(row, sheet),
        warnings: sheet.warnings
          .filter(({ check }) => check === 'unsupportedFormula')
          .map(({ message }) => message),
      }).toEqual({
        value: null,
        warnings: [`This rule value gives no number. ${unsupported}`],
      });
    },
  );

  test("a catalog definition's Item Ability: its Modifier gives 0", () => {
    const row: Case = {
      provenance: provenance('a catalog definition (global, its stored body)'),
      kind: 'itemAbility',
      place: 'modifier',
    };
    expect(read(row, calculateCharacterSheet(storedSheet(row, control)))).toBe(
      5,
    );
    const sheet = calculateCharacterSheet(storedSheet(row, `3 + ${variable}`));
    expect({
      initiative: read(row, sheet),
      warnings: sheet.warnings
        .filter(({ check }) => check === 'unsupportedFormula')
        .map(({ message }) => message),
    }).toEqual({
      initiative: 0,
      warnings: [`This Modifier contributes nothing. ${unsupported}`],
    });
  });

  test('a one-off Condition saved as Dazzled, and one edited to the core-rule Dazzled', () => {
    for (const name of [
      'a one-off Condition saved as Dazzled',
      'a one-off Condition edited to the core-rule Dazzled',
    ]) {
      const row: Case = {
        provenance: provenance(name),
        kind: 'condition',
        place: 'dailyMaximum',
      };
      const sheet = calculateCharacterSheet(
        storedSheet(row, '4 + @favoredClassReward.bardicPerformanceRound'),
      );
      expect({
        value: read(row, sheet),
        warnings: sheet.warnings
          .filter((warning) => warning.subject === 'own-row:ruleValue:0')
          .map((warning) => warning.message),
      }).toEqual({
        value: null,
        warnings: [
          'This rule value gives no number. @favoredClassReward.bardicPerformanceRound is not a supported variable.',
        ],
      });
    }
  });
});

// Fix r4: a Catalog Release that retires a definition keeps its last usable
// body in the retirement report (`payload.lastUsableDefinition`, a `v.any()`
// the walk cannot see into), and `candidateDefinition` projects that body as
// the definition's. Each case stores the definition as the catalog import
// does, a release whose one row is that report, and hands the calculator
// what `candidateDefinition` gives.
const convexModules = import.meta.glob('../../convex/**/*.ts');
const retainedIdentity = 'fixture/retained';

/** The kinds a retained body has here, each as the release body states it. */
const retainedDetails = {
  feat: { kind: 'feat', featTypes: [], repeatable: 'no' },
  trait: { kind: 'trait', traitType: 'basic' },
  classFeature: { kind: 'classFeature' },
} as const;
type RetainedKind = keyof typeof retainedDetails;
const places: Place[] = ['modifier', ...ruleValueKinds];

/** A retained release body, with `formula` in its place. */
function retainedBody(kind: RetainedKind, place: Place, formula: string) {
  const amount = { formula };
  return {
    externalKey: retainedIdentity,
    upstreamKey: retainedIdentity,
    pack: 'fixture',
    name: 'Retained entry',
    detail: retainedDetails[kind],
    description: '',
    sources: [],
    unsupported: [],
    modifiers:
      place === 'modifier'
        ? [{ target: 'init', bonusType: 'untyped', value: amount }]
        : [],
    ...(place === 'modifier'
      ? {}
      : { ruleValues: [ruleValuePlaces[place].store(amount)] }),
  };
}

/**
 * The definition `candidateDefinition` gives for a stored definition of
 * `kind` (a bodiless catalog identity, or a campaign's Catalog Copy of it
 * whose own body has `formula`) under a release retaining a body with
 * `formula`, as the calculator reads it.
 */
async function projected({
  kind,
  place,
  formula,
  copy = false,
}: {
  kind: RetainedKind;
  place: Place;
  formula: string;
  copy?: boolean;
}) {
  const t = convexTest(schema, convexModules);
  return t.run(async (ctx) => {
    const releaseId = await ctx.db.insert('catalogRelease', {
      releaseNumber: 2,
      state: 'prepared',
      baseReleaseNumber: null,
      manifest: {
        formatVersion: 1,
        releaseNumber: 2,
        baseRelease: null,
        inputs: {
          upstream: 'a',
          remaps: 'a',
          curation: 'a',
          localData: 'a',
          parsers: 'a',
          sanitizers: 'a',
          ruleResources: 'a',
          legal: 'a',
          attribution: 'a',
        },
        compatibility: catalogRuntimeCompatibility,
        inputFingerprint: 'a',
        outputFingerprint: 'a',
        artifactFingerprint: 'a',
        batches: [],
      },
      nextBatchIndex: 0,
      batchCount: 1,
      stagedRows: 1,
      reportCategories: [],
      legalKeys: [],
    });
    await ctx.db.insert('catalogReleaseRow', {
      releaseId,
      batchIndex: 0,
      kind: 'report',
      key: `retirement:${retainedIdentity}`,
      payload: {
        externalKey: retainedIdentity,
        kind: 'definition',
        state: 'held',
        lastUsableDefinition: retainedBody(kind, place, formula),
        definitionFingerprint: 'fixture',
      },
    });
    // As `catalogIdentityAllocation` stores an identity: no body.
    const identity = {
      ruleIdentity: retainedIdentity,
      name: 'Retained entry',
      ...storedFields,
      modifiers: [],
      detail: { kind },
    };
    const globalId = await ctx.db.insert('catalogEntry', {
      ...identity,
      scope: 'global',
    });
    const storedId = copy
      ? await ctx.db.insert('catalogEntry', {
          ...identity,
          scope: 'campaign',
          campaignId: await ctx.db.insert('campaign', {
            name: 'Campaign',
            description: '',
            organizationId: 'org',
            ownerId: 'test|owner',
          }),
          campaignPreference: true,
          copiedFrom: globalId,
          copiedFromFingerprint: 'fingerprint',
          ...(formulaFields(place, formula) as Pick<
            Doc<'catalogEntry'>,
            'modifiers' | 'ruleValues'
          >),
        })
      : globalId;
    const release = await ctx.db.get('catalogRelease', releaseId);
    const stored = await ctx.db.get('catalogEntry', storedId);
    if (!release || !stored) throw new Error('Missing fixture');
    const { _id, _creationTime, ...definition } = await candidateDefinition(
      ctx,
      release,
      stored,
    );
    const { _id: _storedId, _creationTime: _stored, ...storedBody } = stored;
    return {
      definition: { _id: 'own', ...definition } as CharacterSheetCatalogEntry,
      unchanged: JSON.stringify(definition) === JSON.stringify(storedBody),
    };
  });
}

const retainedCases = (Object.keys(retainedDetails) as RetainedKind[]).flatMap(
  (kind) => places.map((place) => ({ kind, place })),
);
const retainedRow = ({ kind, place }: { kind: RetainedKind; place: Place }) =>
  ({
    provenance: provenance('a catalog definition (global, its stored body)'),
    kind,
    place,
  }) satisfies Case;

describe('a retained release body, projected by candidateDefinition', () => {
  test.each(retainedCases)(
    'a catalog definition projected from a retained release body ($kind), $place: a supported formula gives its number',
    async ({ kind, place }) => {
      const { definition, unchanged } = await projected({
        kind,
        place,
        formula: control,
      });
      expect(unchanged).toBe(false);
      const row = retainedRow({ kind, place });
      expect(
        read(row, calculateCharacterSheet(sheetWith(kind, definition))),
      ).toBe(shows(row, 5));
    },
  );

  test.each(retainedCases)(
    'a catalog definition projected from a retained release body ($kind), $place: its rule values read the count, its Modifier as before',
    async ({ kind, place }) => {
      const row = retainedRow({ kind, place });
      const input = sheetWith(
        kind,
        (await projected({ kind, place, formula: `3 + ${variable}` }))
          .definition,
      );
      if (place === 'modifier')
        expect(observe(input, variable)).toEqual(
          observe(
            sheetWith(
              kind,
              (
                await projected({
                  kind,
                  place,
                  formula: `3 + ${neverSupported}`,
                })
              ).definition,
            ),
            neverSupported,
          ),
        );
      else {
        expect(read(row, calculateCharacterSheet(input))).toBe(shows(row, 3));
        expect(
          observe(input, variable).warnings.filter(({ message }) =>
            message.includes(variable),
          ),
        ).toEqual([]);
      }
    },
  );

  test.each(places.map((place) => ({ kind: 'feat' as const, place })))(
    "a campaign's Catalog Copy of a retained definition ($kind), $place: keeps its stored body, as before the count existed",
    async ({ kind, place }) => {
      const { definition, unchanged } = await projected({
        kind,
        place,
        formula: `3 + ${variable}`,
        copy: true,
      });
      expect(unchanged).toBe(true);
      const { definition: base } = await projected({
        kind,
        place,
        formula: `3 + ${neverSupported}`,
        copy: true,
      });
      expect(observe(sheetWith(kind, definition), variable)).toEqual(
        observe(sheetWith(kind, base), neverSupported),
      );
    },
  );
});
