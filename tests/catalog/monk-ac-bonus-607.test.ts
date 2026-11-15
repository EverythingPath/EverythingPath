// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { representativeClassCatalog } from '../../convex/lib/representativeClassCatalog';
import { importCatalog } from '../../scripts/catalog/import';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type Ability,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import { materializePinnedTree } from './pinned-sources';

// #607 S1 (monk-ac-607): AC Bonus (MNK) as the importer emits it, through
// the public resolver. The rule (PRD coreRulebook/classes/monk.html:383):
// "the monk adds his Wisdom bonus (if any) to his AC and his CMD. In
// addition, a monk gains a +1 bonus to AC and CMD at 4th level. This bonus
// increases by 1 for every four monk levels thereafter, up to a maximum of
// +5 at 20th level." :384: "These bonuses to AC apply even against touch
// attacks or when the monk is flat-footed." Pathfinder Unchained gives the
// Unchained Monk the same text (unchained/classes/monk.html:406-407). The
// loss conditions (armor, shield, load, immobilized, helpless) are not
// modelled: the row's Note tells the player to switch it off.

const AC_BONUS = 'pf1/4zVndIJ8NMWWzl1T';
const preview = JSON.parse(
  readFileSync(
    'tests/fixtures/class-abilities-607/binding-preview.json',
    'utf8',
  ),
) as {
  entries: (Pick<CharacterSheetCatalogEntry, 'name' | 'modifiers'> & {
    externalKey: string;
    unsupported: { field: string }[];
  })[];
};
const imported = (() => {
  const row = preview.entries.find((entry) => entry.externalKey === AC_BONUS);
  if (!row) throw new Error('The #607 binding preview lacks AC Bonus');
  return row;
})();

// The higher of the two tags (finding 1, fix round 1): the import gives Monk
// (Unchained) its own tag and no counterpart relationship, so it counts under
// `monkUnchained` only; `max` stays right if one is ever supplied.
const formula =
  'max(0, @ability.wis.mod) + floor(max(@classLevel.monk, @classLevel.monkUnchained) / 4)';
const note =
  'He loses these bonuses when he is immobilized or helpless, when he wears any armor, when he carries a shield, or when he carries a medium or heavy load. The sheet does not check this: switch this row off while any of these applies.';

it('imports the two reviewed replacements as untyped AC and CMD Modifiers, with the Note', () => {
  expect(imported).toMatchObject({
    modifiers: [
      { target: 'ac', bonusType: 'untyped', value: { formula } },
      { target: 'cmd', bonusType: 'untyped', value: { formula } },
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
