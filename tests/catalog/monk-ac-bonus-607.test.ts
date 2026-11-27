// @vitest-environment node
import { expect, it } from 'vitest';
import { representativeClassCatalog } from '../../convex/lib/representativeClassCatalog';
import { importCatalog } from '../../scripts/catalog/import';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  modifierConditionSchema,
  personalAdjustmentConditionSchema,
  type Ability,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import { getConditionDefinition } from '../../src/lib/character-sheet-conditions';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import { armorKeys } from './released-armor';
import { importReleasedEntries } from './released-entries';
import { materializePinnedTree } from './pinned-sources';

// #607 S1 (monk-ac-607): AC Bonus (MNK) as the importer emits it, through
// the public resolver. The rule (PRD coreRulebook/classes/monk.html:383):
// "the monk adds his Wisdom bonus (if any) to his AC and his CMD. In
// addition, a monk gains a +1 bonus to AC and CMD at 4th level. This bonus
// increases by 1 for every four monk levels thereafter, up to a maximum of
// +5 at 20th level." :384: "These bonuses to AC apply even against touch
// attacks or when the monk is flat-footed." Pathfinder Unchained gives the
// Unchained Monk the same text (unchained/classes/monk.html:406-407). :384:
// "He loses these bonuses when he is immobilized or helpless, when he wears
// any armor, when he carries a shield, or when he carries a medium or heavy
// load." Both Modifiers carry the `unarmored` condition (rotation-1): the
// sheet drops them while an armor or shield item is active or while Helpless,
// Paralyzed, Unconscious, Petrified or Pinned (root's reading of "immobilized
// or helpless", 2026-11-15). Load is not tracked: the Note says to switch the
// row off then.

const AC_BONUS = 'pf1/4zVndIJ8NMWWzl1T';
/** The Spell Effects the armor tests use, and the spells they name. */
const buffKeys = {
  mageArmor: 'pf1/IlO0CNpAIKZtNYu8',
  shield: 'pf1/olTpyao476hOEzzm',
} as const;
const spellKeys = ['pf1/ucc0a31d1y86oleh', 'pf1/sz7j540uypmqqvti'] as const;
// AC Bonus, the armors and the Spell Effects, imported from the pinned store.
const released = await importReleasedEntries([
  AC_BONUS,
  armorKeys.breastplate,
  armorKeys.heavySteelShield,
  ...Object.values(buffKeys),
  ...spellKeys,
]);
const imported = (() => {
  const row = released.entries.get(AC_BONUS);
  if (!row) throw new Error('The import lacks AC Bonus');
  return row as Pick<CharacterSheetCatalogEntry, 'name' | 'modifiers'> & {
    externalKey: string;
    unsupported: { field: string }[];
  };
})();

// The higher of the two tags (finding 1, fix round 1): the import gives Monk
// (Unchained) its own tag and no counterpart relationship, so it counts under
// `monkUnchained` only; `max` stays right if one is ever supplied.
const formula =
  'max(0, @ability.wis.mod) + floor(max(@classLevel.monk, @classLevel.monkUnchained) / 4)';
const note =
  'He loses these bonuses when he is immobilized or helpless, when he wears any armor, when he carries a shield, or when he carries a medium or heavy load. The sheet removes them by itself while an armor or shield item is active, or while he is Helpless, Paralyzed, Unconscious, Petrified or Pinned. It does not track load: switch this row off while he carries a medium or heavy load, or is immobilized some other way.';

it('imports the two reviewed replacements as untyped AC and CMD Modifiers lost when not unarmored, with the Note', () => {
  expect(imported).toMatchObject({
    modifiers: [
      {
        target: 'ac',
        bonusType: 'untyped',
        value: { formula },
        condition: { unarmored: true },
      },
      {
        target: 'cmd',
        bonusType: 'untyped',
        value: { formula },
        condition: { unarmored: true },
      },
    ],
    situationalNotes: [{ text: note }],
  });
  expect(imported.unsupported.filter((row) => row.field === 'changes')).toEqual(
    [],
  );
});

/** Released classes: their release keys and pinned bodies (pf1 packs/classes). */
const releasedClasses = {
  monk: {
    key: 'pf1/W8dxwZ1CZiwLKsqr',
    file: 'monk.W8dxwZ1CZiwLKsqr.yaml',
    seeded: 'monk',
  },
  monkUnchained: {
    key: 'pf1/5mQIOIw4hDhlREPo',
    file: 'monk-unchained.5mQIOIw4hDhlREPo.yaml',
    seeded: 'unchained-monk',
  },
  fighter: {
    key: 'pf1/WLqBCT5DqmGAx8Wd',
    file: 'fighter.WLqBCT5DqmGAx8Wd.yaml',
    seeded: 'fighter',
  },
} as const;
type ClassName = keyof typeof releasedClasses;

/**
 * The three classes as the import emits them, re-extracted from the shared
 * store: their tags and counterpart relationship are the import's own, never
 * the seeded catalog's (the review's probe, fix round 1).
 */
const importedClasses = await (async () => {
  const tree = await materializePinnedTree(
    Object.values(releasedClasses).map(
      ({ file }) => `pf1/packs/classes/${file}`,
    ),
  );
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: Object.values(releasedClasses).map(({ key }) => key),
      wholeCorpus: false,
    });
    return new Map(
      artifact.catalog.entries.map((row) => [row.externalKey, row] as const),
    );
  } finally {
    await tree.dispose();
  }
})();

function importedClass(name: ClassName) {
  const row = importedClasses.get(releasedClasses[name].key);
  if (row?.detail?.kind !== 'class')
    throw new Error(`The import emits no class ${name}`);
  return row.detail as { tag?: string; counterpartOf?: string };
}

it('takes the class tags as the import emits them: Monk (Unchained) has its own tag and no counterpart', () => {
  expect(
    Object.fromEntries(
      (Object.keys(releasedClasses) as ClassName[]).map((name) => {
        const { tag, counterpartOf } = importedClass(name);
        return [name, { tag, counterpartOf }];
      }),
    ),
  ).toEqual({
    monk: { tag: 'monk', counterpartOf: undefined },
    monkUnchained: { tag: 'monkUnchained', counterpartOf: undefined },
    fighter: { tag: 'fighter', counterpartOf: undefined },
  });
});

/**
 * A released class: the seeded progression (hit die, attack bonus, saves),
 * with the import's tag and counterpart relationship. `counterpart` adds the
 * relationship the import does not supply, to show it does not count twice.
 */
function classDefinition(
  name: ClassName,
  counterpart = false,
): CharacterSheetCatalogEntry {
  const { key, seeded } = releasedClasses[name];
  const definition = representativeClassCatalog.find(
    (row) => row.ruleIdentity === seeded,
  );
  if (definition?.detail.kind !== 'class')
    throw new Error(`Missing seeded ${seeded}`);
  const { counterpartOf: _seeded, ...detail } = definition.detail as {
    counterpartOf?: string;
  } & typeof definition.detail;
  const { tag, counterpartOf } = importedClass(name);
  return {
    ...definition,
    _id: key,
    ruleIdentity: key,
    detail: {
      ...detail,
      tag,
      // Granted at 1st by Monk and Monk (Unchained) (Foundry classAssociations).
      featuresByLevel:
        name === 'fighter' ? [] : [{ classLevel: 1, catalogEntryId: AC_BONUS }],
      ...(counterpartOf ? { counterpartOf } : {}),
      ...(counterpart && name === 'monkUnchained'
        ? { counterpartOf: releasedClasses.monk.key }
        : {}),
    },
  } as CharacterSheetCatalogEntry;
}

function sheet({
  levels,
  wisdom,
  entries = [],
  counterpart = false,
}: {
  levels: readonly (readonly [ClassName, number])[];
  wisdom: number;
  entries?: SheetEntry[];
  counterpart?: boolean;
}): CharacterSheetInput {
  const rows = levels.flatMap(([name, count]) =>
    Array.from({ length: count }, () => releasedClasses[name].key),
  );
  const scores: Partial<Record<Ability, number>> = { wisdom };
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
      ...rows.map(
        (classEntryId, index): SheetEntry => ({
          _id: `level-${index + 1}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            position: index + 1,
            classEntryId,
            hpGained: 5,
          },
        }),
      ),
      ...entries,
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: scores[ability] ?? 10,
        })),
      },
      ...(Object.keys(releasedClasses) as ClassName[]).map((name) =>
        classDefinition(name, counterpart),
      ),
      {
        _id: AC_BONUS,
        ruleIdentity: AC_BONUS,
        name: imported.name,
        modifiers: imported.modifiers,
        detail: { kind: 'classFeature' },
      },
    ],
  };
}

const statistics = [
  'ac',
  'touchAc',
  'flatFootedAc',
  'cmd',
  'flatFootedCmd',
] as const;

/** The five totals, and the AC Bonus row's own contribution to each. */
function defenses(input: CharacterSheetInput) {
  const calculated = calculateCharacterSheet(input);
  return Object.fromEntries(
    statistics.map((name) => {
      const statistic = calculated.derivedStatistics[name];
      return [
        name,
        {
          total: statistic.total,
          acBonus: statistic.applied
            .filter((row) => row.catalogEntryId === AC_BONUS)
            .reduce((sum, row) => sum + row.value, 0),
        },
      ];
    }),
  ) as Record<(typeof statistics)[number], { total: number; acBonus: number }>;
}

/** The granted row, switched off as the sheet's switch saves it. */
function switchedOff(input: CharacterSheetInput): SheetEntry {
  const granted = calculateCharacterSheet(input).resolvedEntries.find(
    (row) =>
      row.origin === 'grant' &&
      'catalogEntryId' in row.entry &&
      row.entry.catalogEntryId === AC_BONUS,
  );
  if (!granted || !('grantKey' in granted.entry) || !granted.entry.grantKey)
    throw new Error('AC Bonus is not granted');
  return { ...granted.entry, _id: 'stored-ac-bonus', active: false };
}

/** Warnings that a Modifier's formula could not be read. */
const formulaWarnings = (input: CharacterSheetInput) =>
  calculateCharacterSheet(input).warnings.filter(
    (row) =>
      row.check === 'unsupportedFormula' || row.check === 'formulaDependency',
  );

const each = (value: number) =>
  Object.fromEntries(statistics.map((name) => [name, value]));
const contributions = (input: CharacterSheetInput) =>
  Object.fromEntries(
    Object.entries(defenses(input)).map(([name, row]) => [name, row.acBonus]),
  );

it.each([
  // Wisdom 14 is a +2 bonus; +1 at 4th (:383): +3.
  { case: 'Monk 4, Wisdom 14', levels: [['monk', 4]], wisdom: 14, bonus: 3 },
  // Wisdom 8 is a −1 modifier: no bonus "(if any)"; +1 at 4th (:383).
  { case: 'Monk 4, Wisdom 8', levels: [['monk', 4]], wisdom: 8, bonus: 1 },
  // Wisdom 12 is +1; no level bonus before 4th (:383).
  { case: 'Monk 1, Wisdom 12', levels: [['monk', 1]], wisdom: 12, bonus: 1 },
  // +5 at 20th, the maximum (:383); Wisdom 10 adds nothing.
  { case: 'Monk 20, Wisdom 10', levels: [['monk', 20]], wisdom: 10, bonus: 5 },
  // The Unchained Monk's own text (unchained/classes/monk.html:406).
  {
    case: 'Monk (Unchained) 4, Wisdom 14',
    levels: [['monkUnchained', 4]],
    wisdom: 14,
    bonus: 3,
  },
  // Its +5 at 20th (unchained/classes/monk.html:406); Wisdom 10 adds nothing.
  {
    case: 'Monk (Unchained) 20, Wisdom 10',
    levels: [['monkUnchained', 20]],
    wisdom: 10,
    bonus: 5,
  },
  // Only monk levels count ("for every four monk levels"): Fighter levels add
  // nothing, so a Monk 1 / Fighter 4 gets the Wisdom bonus alone.
  {
    case: 'Monk 1 / Fighter 4, Wisdom 12',
    levels: [
      ['monk', 1],
      ['fighter', 4],
    ],
    wisdom: 12,
    bonus: 1,
  },
] as const)(
  '$case: +$bonus on AC, touch AC, flat-footed AC, CMD and flat-footed CMD',
  ({ levels, wisdom, bonus }) => {
    const input = sheet({ levels, wisdom });
    expect(contributions(input)).toEqual(each(bonus));
    // The tag the sheet lacks reads 0 and raises nothing.
    expect(formulaWarnings(input)).toEqual([]);
    // Switched off, the bonus is gone from every total.
    const off = sheet({ levels, wisdom, entries: [switchedOff(input)] });
    expect(contributions(off)).toEqual(each(0));
    const on = defenses(input);
    const without = defenses(off);
    for (const name of statistics)
      expect(on[name].total - without[name].total).toBe(bonus);
  },
);

it('gives a non-monk nothing: the Fighter has no AC Bonus row', () => {
  const input = sheet({ levels: [['fighter', 4]], wisdom: 14 });
  expect(
    calculateCharacterSheet(input).resolvedEntries.some(
      (row) =>
        'catalogEntryId' in row.entry && row.entry.catalogEntryId === AC_BONUS,
    ),
  ).toBe(false);
  expect(contributions(input)).toEqual(each(0));
  // Base AC 10, Dexterity +0: the Wisdom bonus does not reach AC.
  expect(defenses(input).ac.total).toBe(10);
});

it('counts an Unchained Monk once if a counterpart relationship is supplied', () => {
  // With the relationship its levels count under both tags; the higher of
  // the two, not their sum, keeps Unchained 4 / Wisdom 14 at +3 and
  // Unchained 8 / Wisdom 10 at +2 (unchained/classes/monk.html:406).
  for (const [levels, wisdom, bonus] of [
    [4, 14, 3],
    [8, 10, 2],
  ] as const) {
    const input = sheet({
      levels: [['monkUnchained', levels]],
      wisdom,
      counterpart: true,
    });
    expect(contributions(input)).toEqual(each(bonus));
    expect(formulaWarnings(input)).toEqual([]);
  }
});

it('gives a Fighter who somehow holds the feature the Wisdom bonus alone', () => {
  // No monk levels of either kind: both tags read 0 and raise nothing.
  const input = sheet({
    levels: [['fighter', 4]],
    wisdom: 14,
    entries: [
      {
        _id: 'stored-ac-bonus',
        kind: 'classFeature',
        active: true,
        catalogEntryId: AC_BONUS,
        state: { kind: 'classFeature' },
      } as SheetEntry,
    ],
  });
  expect(contributions(input)).toEqual(each(2));
  expect(formulaWarnings(input)).toEqual([]);
});

// rotation-1 (S2): the loss conditions of monk.html:384 the sheet checks.

/** An imported armor or shield (the #424 batch's), without its bash. */
function armorItem(key: string): CharacterSheetCatalogEntry {
  const row = released.entries.get(key);
  if (row?.detail?.kind !== 'item' || !row.detail.armor)
    throw new Error(`Missing imported armor ${key}`);
  const { weapon: _bash, ...detail } = row.detail;
  return {
    _id: key,
    ruleIdentity: key,
    name: row.name,
    modifiers: [],
    detail,
  } as CharacterSheetCatalogEntry;
}
const BREASTPLATE = armorKeys.breastplate;
const HEAVY_STEEL_SHIELD = armorKeys.heavySteelShield;

/** An imported Spell Effect (the buffs-547 batch's). */
const buffs = Object.values(buffKeys).map((key) => {
  const row = released.entries.get(key);
  if (!row) throw new Error(`The import lacks ${key}`);
  return row as unknown as CharacterSheetCatalogEntry & { externalKey: string };
});
function spellEffect(name: string): CharacterSheetCatalogEntry {
  const row = buffs.find((entry) => entry.name === name);
  if (row?.detail?.kind !== 'spellEffect')
    throw new Error(`Missing imported Spell Effect ${name}`);
  return {
    _id: row.externalKey,
    ruleIdentity: row.externalKey,
    name: row.name,
    modifiers: row.modifiers,
    detail: row.detail,
  };
}

/** The Dodge feat (CRB p. 122): +1 dodge bonus to AC, no condition. */
const dodge: CharacterSheetCatalogEntry = {
  _id: 'dodge',
  ruleIdentity: 'dodge',
  name: 'Dodge',
  modifiers: [{ target: 'ac', bonusType: 'dodge', value: 1 }],
  detail: { kind: 'feat' },
};

type Extra =
  | { kind: 'item'; definition: CharacterSheetCatalogEntry; active: boolean }
  | { kind: 'spellEffect'; definition: CharacterSheetCatalogEntry }
  | { kind: 'feat'; definition: CharacterSheetCatalogEntry }
  | { kind: 'condition'; conditionKey: string };

function withExtras(
  input: CharacterSheetInput,
  extras: readonly Extra[],
): CharacterSheetInput {
  const rows = extras.map((extra, index) => {
    const id = `extra-${index}`;
    if (extra.kind === 'condition') {
      const definition = getConditionDefinition(
        extra.conditionKey as Parameters<typeof getConditionDefinition>[0],
      );
      return {
        entry: {
          _id: id,
          kind: 'condition',
          active: true,
          catalogEntryId: id,
          state: { kind: 'condition' },
        } as SheetEntry,
        catalog: {
          _id: id,
          ruleIdentity: definition.ruleIdentity,
          name: definition.name,
          modifiers: [],
          detail: { kind: 'condition', conditionKey: extra.conditionKey },
        } as CharacterSheetCatalogEntry,
      };
    }
    const state =
      extra.kind === 'item'
        ? { kind: 'item' as const }
        : extra.kind === 'spellEffect'
          ? { kind: 'spellEffect' as const, casterLevel: 1 }
          : { kind: 'feat' as const };
    return {
      entry: {
        _id: id,
        kind: extra.kind,
        active: extra.kind === 'item' ? extra.active : true,
        catalogEntryId: extra.definition._id,
        state,
      } as SheetEntry,
      catalog: extra.definition,
    };
  });
  return {
    ...input,
    entries: [...input.entries, ...rows.map((row) => row.entry)],
    catalogEntries: [
      ...input.catalogEntries,
      ...rows.map((row) => row.catalog),
    ],
  };
}

/**
 * Why each statistic shows the AC Bonus as lost, once per reason: CMD lists
 * both the AC and the CMD Modifier. Its "Does not apply to CMD." row for the
 * AC Modifier is how CMD always lists an untyped AC bonus, armor or not.
 */
function lost(input: CharacterSheetInput) {
  const calculated = calculateCharacterSheet(input);
  return Object.fromEntries(
    statistics.map((name) => [
      name,
      [
        ...new Map(
          calculated.derivedStatistics[name].suppressed
            .filter(
              (row) =>
                row.catalogEntryId === AC_BONUS &&
                row.reason !== 'Does not apply to CMD.',
            )
            .map((row) => [
              `${row.reason}|${row.suppressedBy}`,
              { reason: row.reason, suppressedBy: row.suppressedBy },
            ]),
        ).values(),
      ],
    ]),
  );
}
const lostEverywhere = (reason: string, suppressedBy: string) =>
  Object.fromEntries(
    statistics.map((name) => [name, [{ reason, suppressedBy }]]),
  );

const monk4 = () => sheet({ levels: [['monk', 4]], wisdom: 14 });

it('keeps +3 for a Monk 4 / Wisdom 14 with no armor, with an armor only carried, or under Mage Armor', () => {
  // No armor: Wisdom +2 and +1 at 4th (:383).
  expect(contributions(monk4())).toEqual(each(3));
  expect(lost(monk4())).toEqual(
    Object.fromEntries(statistics.map((name) => [name, []])),
  );
  // A Breastplate carried but not worn (inactive) is not "wears any armor".
  const carried = withExtras(monk4(), [
    { kind: 'item', definition: armorItem(BREASTPLATE), active: false },
  ]);
  expect(contributions(carried)).toEqual(each(3));
  // Mage Armor (CRB p. 306) is a Spell Effect, not armor worn: the bonus
  // stays, and its +4 armor bonus adds to AC and flat-footed AC.
  const mageArmor = withExtras(monk4(), [
    { kind: 'spellEffect', definition: spellEffect('Mage Armor') },
  ]);
  expect(contributions(mageArmor)).toEqual(each(3));
  expect(defenses(mageArmor).ac.total).toBe(10 + 4 + 3);
  // The Shield spell (CRB p. 340) likewise is not a shield carried.
  const shieldSpell = withExtras(monk4(), [
    { kind: 'spellEffect', definition: spellEffect('Shield') },
  ]);
  expect(contributions(shieldSpell)).toEqual(each(3));
});

it('loses the bonus while a Breastplate is worn, and shows why', () => {
  const input = withExtras(monk4(), [
    { kind: 'item', definition: armorItem(BREASTPLATE), active: true },
  ]);
  expect(contributions(input)).toEqual(each(0));
  expect(lost(input)).toEqual(
    lostEverywhere('Lost while wearing Breastplate.', 'extra-0'),
  );
  // AC 10 + Breastplate 6, Dexterity +0; CMD 10 + BAB 3 (seeded Monk 4).
  const totals = defenses(input);
  expect(totals.ac.total).toBe(16);
  expect(totals.touchAc.total).toBe(10);
  expect(totals.cmd.total).toBe(defenses(monk4()).cmd.total - 3);
});

it('loses the bonus while a Heavy Steel Shield is carried, and shows why', () => {
  const input = withExtras(monk4(), [
    { kind: 'item', definition: armorItem(HEAVY_STEEL_SHIELD), active: true },
  ]);
  expect(contributions(input)).toEqual(each(0));
  expect(lost(input)).toEqual(
    lostEverywhere('Lost while carrying Heavy Steel Shield.', 'extra-0'),
  );
});

it.each(['helpless', 'paralyzed', 'unconscious', 'petrified', 'pinned'])(
  'loses the bonus while %s, and shows why',
  (conditionKey) => {
    const input = withExtras(monk4(), [{ kind: 'condition', conditionKey }]);
    expect(contributions(input)).toEqual(each(0));
    const name = getConditionDefinition(
      conditionKey as Parameters<typeof getConditionDefinition>[0],
    ).name;
    expect(lost(input)).toEqual(
      lostEverywhere(`Lost while ${name}.`, 'extra-0'),
    );
  },
);

it('keeps the bonus while only Grappled or Entangled (not in the default "immobilized" set)', () => {
  for (const conditionKey of ['grappled', 'entangled'])
    expect(
      contributions(withExtras(monk4(), [{ kind: 'condition', conditionKey }])),
    ).toEqual(each(3));
});

it('still lets the player switch the row off, armor or not', () => {
  const off = sheet({
    levels: [['monk', 4]],
    wisdom: 14,
    entries: [switchedOff(monk4())],
  });
  expect(contributions(off)).toEqual(each(0));
  expect(lost(off)).toEqual(
    Object.fromEntries(statistics.map((name) => [name, []])),
  );
  const offInArmor = withExtras(off, [
    { kind: 'item', definition: armorItem(BREASTPLATE), active: true },
  ]);
  expect(contributions(offInArmor)).toEqual(each(0));
});

it('leaves a Modifier without the condition untouched in armor: Dodge keeps its +1', () => {
  const unarmored = withExtras(monk4(), [{ kind: 'feat', definition: dodge }]);
  const armored = withExtras(monk4(), [
    { kind: 'feat', definition: dodge },
    { kind: 'item', definition: armorItem(BREASTPLATE), active: true },
  ]);
  const dodgeOn = (input: CharacterSheetInput) =>
    calculateCharacterSheet(input)
      .derivedStatistics.ac.applied.filter(
        (row) => row.catalogEntryId === 'dodge',
      )
      .reduce((sum, row) => sum + row.value, 0);
  expect(dodgeOn(unarmored)).toBe(1);
  expect(dodgeOn(armored)).toBe(1);
  // AC 10 + Breastplate 6 + Dodge 1: the AC Bonus alone is gone.
  expect(defenses(armored).ac.total).toBe(17);
});

it('treats a Monk (Unchained) the same way (unchained/classes/monk.html:407)', () => {
  const unchained = () => sheet({ levels: [['monkUnchained', 4]], wisdom: 14 });
  expect(contributions(unchained())).toEqual(each(3));
  for (const extra of [
    { kind: 'item', definition: armorItem(BREASTPLATE), active: true },
    { kind: 'item', definition: armorItem(HEAVY_STEEL_SHIELD), active: true },
    { kind: 'condition', conditionKey: 'helpless' },
  ] as const)
    expect(contributions(withExtras(unchained(), [extra]))).toEqual(each(0));
  expect(
    contributions(
      withExtras(unchained(), [
        { kind: 'spellEffect', definition: spellEffect('Mage Armor') },
      ]),
    ),
  ).toEqual(each(3));
});

// fix r1 (spec #1): the permanent Intelligence the skill budget reads drops a
// lost `unarmored` Modifier as the sheet does. A player's own class feature
// (a Catalog Copy) giving +4 Intelligence while unarmored, on a Fighter 3
// with Intelligence 10 (seeded Fighter: 2 ranks per level).
it('keeps a lost Intelligence Modifier out of the skill budget too', () => {
  const insight: CharacterSheetCatalogEntry = {
    _id: 'unarmored-insight',
    ruleIdentity: 'unarmored-insight',
    name: 'Unarmored insight',
    modifiers: [
      {
        target: 'ability.int',
        bonusType: 'untyped',
        value: 4,
        condition: { unarmored: true },
      },
    ],
    detail: { kind: 'classFeature' },
  };
  const fighter3 = (extras: readonly Extra[]) => {
    const input = sheet({
      levels: [['fighter', 3]],
      wisdom: 10,
      entries: [
        {
          _id: 'insight-row',
          kind: 'classFeature',
          active: true,
          catalogEntryId: insight._id,
          state: { kind: 'classFeature' },
        } as SheetEntry,
      ],
    });
    return withExtras(
      { ...input, catalogEntries: [...input.catalogEntries, insight] },
      extras,
    );
  };
  const read = (input: CharacterSheetInput) => {
    const calculated = calculateCharacterSheet(input);
    return {
      intelligence: calculated.abilities.intelligence.score,
      intelligenceModifier: calculated.budgets.intelligenceModifier,
      skillRanks: calculated.budgets.skillRanks,
      projected:
        calculateCharacterSheetProjections(input).current.budgets.skillRanks,
    };
  };
  // Unarmored: Intelligence 14, +2, (2 + 2) x 3 = 12 ranks.
  expect(read(fighter3([]))).toEqual({
    intelligence: 14,
    intelligenceModifier: 2,
    skillRanks: 12,
    projected: 12,
  });
  // In a worn Breastplate the +4 is lost, on the sheet and in the budget:
  // 2 x 3 = 6 ranks.
  expect(
    read(
      fighter3([
        { kind: 'item', definition: armorItem(BREASTPLATE), active: true },
      ]),
    ),
  ).toEqual({
    intelligence: 10,
    intelligenceModifier: 0,
    skillRanks: 6,
    projected: 6,
  });
  // A condition is temporary, so permanent Intelligence keeps the +4 while
  // Helpless, as the permanent projection does; the sheet shows it lost.
  expect(
    read(fighter3([{ kind: 'condition', conditionKey: 'helpless' }])),
  ).toEqual({
    intelligence: 10,
    intelligenceModifier: 2,
    skillRanks: 12,
    projected: 12,
  });
});

it('lets a catalog Modifier carry the condition, but not a personal adjustment', () => {
  const modifier = {
    kind: 'modifier',
    target: 'ac',
    bonusType: 'untyped',
    value: 1,
    condition: { unarmored: true },
  };
  expect(outputSchema.safeParse(modifier).success).toBe(true);
  expect(modifierConditionSchema.safeParse({ unarmored: true }).success).toBe(
    true,
  );
  // A player's own adjustment names no rule the sheet can test it against.
  expect(
    personalAdjustmentConditionSchema.safeParse({ unarmored: true }).success,
  ).toBe(false);
});
