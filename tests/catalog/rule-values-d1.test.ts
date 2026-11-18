// @vitest-environment node
// stats-d1 part B (PRD #251; GLOSSARY: Rule value): the four rule-value
// records that put channel dice and damage reduction on real rows, written
// drafted; the record step checked three on a captured review (run
// t3-review-39c11ce7…) and the Mad Dog's stays drafted. Drafted, they change
// no entry; checked (in memory, all four), they give the party's sheets their
// dice and damage reduction; as committed, the dice alone. Characters are numbers (party-builds.json).
// Every case runs on the pinned tree. The Damage Reduction the Barbarian, the
// Unchained Barbarian and the Bloodrager share has no record (fix r1): its
// rows would count every class's increments under the one parent, so a
// Barbarian 10 / Bloodrager 10 would have DR 3/-, and no record of the landed
// kinds keeps each class's line its own.
import { readFile } from 'node:fs/promises';
import { afterAll, describe, expect, it } from 'vitest';
import { hashText, type RuleValueRecord } from '../../scripts/catalog/curation';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { pcgenOwnerSelection } from '../../scripts/catalog/pcgen-owners';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { preparedArchetypeDetail } from '../../src/lib/catalog/imported-archetype';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import {
  ownerEmissionFoundryFiles,
  pcgenOwnerEmissionFiles,
} from '../fixtures/pcgen-716/owner-emission-files';
import { materializePinnedTree } from './pinned-sources';

const keys = {
  channelEnergy: 'pf1/kXXz1lO4i7CibHJ9',
  channelPositiveEnergy: 'pf1/tHObxrPeyhimmz9V',
  layOnHands: 'pf1/WhE4j0Jc82npdMCP',
  damageReduction: 'pf1/RENIeTVjWB7Mq6Mw',
  madDogDamageReduction: 'everythingpath/barbarian-mad-dog-damage-reduction',
} as const;
const classes = {
  cleric: 'pf1/SjFqQceVeVBzBwgn',
  paladin: 'pf1/ohptcds1d5oG6Bjh',
  barbarian: 'pf1/g3pq7xWWdUVYw6ai',
  unchainedBarbarian: 'pf1/W3EjUgYLJ1D9qDKw',
  bloodrager: 'pf1/E27lMw9YNOAjS009',
} as const;
const archetypes = {
  ecclesitheurge: 'everythingpath/cleric-ecclesitheurge',
  madDog: 'everythingpath/barbarian-mad-dog',
} as const;

/** The records' values as the boundary rows give them (ORCH stats-d1/boundary.md). */
const expected = [
  [
    keys.madDogDamageReduction,
    {
      kind: 'damageReduction',
      amount: { formula: 'floor((@classLevel.barbarian - 7) / 3)' },
      bypass: '-',
    },
  ],
  [
    keys.layOnHands,
    {
      kind: 'dice',
      die: 6,
      amount: { formula: 'floor(@classLevel.paladin / 2)' },
    },
  ],
  [keys.channelEnergy, { kind: 'dice', die: 6, amount: { rows: {} } }],
  [
    keys.channelPositiveEnergy,
    {
      kind: 'dice',
      die: 6,
      amount: { formula: 'ceil(@classLevel.paladin / 2)' },
    },
  ],
] as const;
const batchKeys = new Set<string>(expected.map(([key]) => key));
const committed = (reviewedCuration.ruleValues ?? []).filter(
  ({ externalKey }) =>
    batchKeys.has(externalKey) || externalKey === keys.damageReduction,
);

const tree = await materializePinnedTree([
  ...ownerEmissionFoundryFiles,
  'pf1/packs/class-abilities/damage-reduction.RENIeTVjWB7Mq6Mw.yaml',
  'pf1/packs/classes/barbarian-unchained.W3EjUgYLJ1D9qDKw.yaml',
  'pf1/packs/classes/bloodrager.E27lMw9YNOAjS009.yaml',
  'pf1/packs/classes/paladin.ohptcds1d5oG6Bjh.yaml',
  'pf1/packs/class-abilities/lay-on-hands.WhE4j0Jc82npdMCP.yaml',
  'pf1/packs/class-abilities/channel-positive-energy.tHObxrPeyhimmz9V.yaml',
  ...pcgenOwnerEmissionFiles.map(
    (path) => `pcgen/${pcgenPin.directory}/${path}`,
  ),
]);
afterAll(() => tree.dispose());
const remaps: unknown = JSON.parse(
  await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
);
const selection = pcgenOwnerSelection.filter(
  ({ key }) =>
    key === 'Cleric Archetype ~ Ecclesitheurge' ||
    key === 'Barbarian Archetype ~ Mad Dog',
);
type Artifact = Awaited<ReturnType<typeof importCatalog>>;
const emit = (ruleValues?: readonly RuleValueRecord[]) => {
  const { ruleValues: _committed, ...overlay } = reviewedCuration;
  return importCatalog({
    systemPath: tree.systemPath,
    contentPath: tree.contentPath,
    remaps,
    curation: ruleValues ? { ...overlay, ruleValues } : overlay,
    pcgen: { path: tree.pcgenPath, selection },
  });
};

/**
 * The committed records in each review state, whatever the record step has
 * done since: drafted as the batch wrote them, and checked in memory under a
 * placeholder receipt.
 */
const draftedInMemory = committed.map(
  ({
    externalKey,
    descriptionSha256,
    outputs,
    rationale,
  }): RuleValueRecord => ({
    externalKey,
    descriptionSha256,
    outputs,
    rationale,
    status: 'drafted',
  }),
);
const checkedInMemory = draftedInMemory.map(
  (record): RuleValueRecord => ({
    ...record,
    status: 'checked',
    reviewedBy: 'in-memory check (rule-values-d1.test.ts)',
    reviewedOn: '2026-11-17',
    receipt: `t3-review-${'0'.repeat(64)}`,
  }),
);
const without = await emit();
const drafted = await emit(draftedInMemory);
const checked = await emit(checkedInMemory);
const asCommitted = await emit(committed);

/** The imported entries as a release prepares them for the sheet, rule values and rows only. */
function sheetCatalog(artifact: Artifact): CharacterSheetCatalogEntry[] {
  const byKey = new Map(
    artifact.catalog.entries.map((entry) => [entry.externalKey, entry]),
  );
  return artifact.catalog.entries.flatMap(
    (entry): CharacterSheetCatalogEntry[] => {
      const base = {
        _id: entry.externalKey,
        ruleIdentity: entry.externalKey,
        name: entry.name,
        modifiers: [],
        ...(entry.ruleValues && { ruleValues: entry.ruleValues }),
      };
      // The imported entry schema types the class's progression fields.
      const { detail } = importedCatalogEntrySchema.parse(entry);
      if (detail.kind === 'class')
        return [
          {
            ...base,
            detail: {
              kind: 'class',
              classKind: detail.classKind,
              tag: detail.tag,
              hitDie: detail.hitDie,
              bab: detail.bab,
              saves: detail.saves,
              skillRanksPerLevel: detail.skillRanksPerLevel,
              featuresByLevel: detail.featuresByLevel
                .filter(({ externalKey }) => byKey.has(externalKey))
                .map(({ classLevel, externalKey }) => ({
                  classLevel,
                  catalogEntryId: externalKey,
                })),
              picksByLevel: [],
            },
          },
        ];
      if (detail.kind === 'classFeature')
        return [
          {
            ...base,
            detail: {
              kind: 'classFeature',
              ...(detail.parentFeature && {
                parentFeature: detail.parentFeature,
              }),
              ...(detail.part && { part: detail.part }),
            },
          },
        ];
      if (detail.kind === 'archetype')
        return [
          {
            ...base,
            detail: preparedArchetypeDetail(detail, (key) => {
              const target = byKey.get(key)?.detail;
              return {
                id: key,
                ruleIdentity: key,
                ...(target?.kind === 'classFeature'
                  ? { parentFeature: target.parentFeature, part: target.part }
                  : {}),
              };
            }),
          },
        ];
      return [];
    },
  );
}

type ClassLevels = readonly (readonly [classKey: string, level: number])[];

/** A Character of these levels, class by class, with an archetype or none. */
function character(
  artifact: Artifact,
  levels: ClassLevels,
  archetype?: string,
): CharacterSheetInput {
  const positions = levels.flatMap(([classKey, level]) =>
    Array.from({ length: level }, () => classKey),
  );
  const entries: SheetEntry[] = [
    {
      _id: 'base-row',
      kind: 'base',
      active: true,
      catalogEntryId: 'base',
      state: { kind: 'base' },
    },
    ...positions.map(
      (classKey, index): SheetEntry => ({
        _id: `level-${index + 1}`,
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId: classKey,
          position: index + 1,
          hpGained: 5,
        },
      }),
    ),
    ...(archetype
      ? [
          {
            _id: 'archetype-row',
            kind: 'archetype' as const,
            active: true,
            catalogEntryId: archetype,
            state: { kind: 'archetype' as const },
          },
        ]
      : []),
  ];
  return {
    characterKind: 'pc',
    entries,
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: 10,
        })),
      },
      ...sheetCatalog(artifact),
    ],
  };
}
const sheet = (
  artifact: Artifact,
  [classKey, level, archetype]: readonly [string, number, string?],
) =>
  calculateCharacterSheet(character(artifact, [[classKey, level]], archetype));
const multiclass = (artifact: Artifact, levels: ClassLevels) =>
  calculateCharacterSheet(character(artifact, levels));

/** Each dice feature number as "<entry>: <count>d<die>". */
function dice(result: ReturnType<typeof calculateCharacterSheet>) {
  const names = new Map(
    result.resolvedEntries.map(({ entry }) => [
      entry._id,
      'catalogEntryId' in entry ? entry.catalogEntryId : entry._id,
    ]),
  );
  return result.featureNumbers.map(
    ({ entryId, count, die }) => `${names.get(entryId)}: ${count}d${die}`,
  );
}
/** The damage reduction lines and statistic, as the Defenses block reads them. */
function damageReduction(result: ReturnType<typeof calculateCharacterSheet>) {
  return {
    lines: result.damageReduction.lines.map(
      ({ name, value, bypass, applies }) =>
        `${name} ${value}/${bypass}${applies ? ' (applies)' : ''}`,
    ),
    values: result.damageReduction.values.map(
      ({ value, bypass }) => `${value}/${bypass}`,
    ),
  };
}

describe('the stats-d1 rule-value records (part B)', () => {
  it('are committed with exactly the boundary’s values, one per entry, each bound to its entry’s current description; the shared Damage Reduction has none', () => {
    expect(
      committed.map(({ externalKey, outputs }) => [
        externalKey,
        ...outputs.map(({ ruleValue }) => ruleValue),
      ]),
    ).toEqual(expected);
    for (const record of committed) {
      const entry = checked.catalog.entries.find(
        ({ externalKey }) => externalKey === record.externalKey,
      );
      expect(entry && hashText(entry.description), record.externalKey).toBe(
        record.descriptionSha256,
      );
    }
  });

  it('drafted, change no entry and no sheet: the entries are those of the overlay without the collection, and no character has dice or damage reduction', () => {
    expect(drafted.catalog.entries).toEqual(without.catalog.entries);
    expect(drafted.curation.ruleValues).toEqual(
      committed.map(({ externalKey }) => ({ externalKey, status: 'drafted' })),
    );
    for (const result of [
      sheet(drafted, [classes.cleric, 8]),
      sheet(drafted, [classes.paladin, 4]),
      sheet(drafted, [classes.barbarian, 10, archetypes.madDog]),
    ]) {
      expect(result.featureNumbers).toEqual([]);
      expect(result.damageReduction.lines).toEqual([]);
    }
  });

  it('checked, apply to their four entries and to no increment', () => {
    expect(checked.curation.ruleValues).toEqual(
      committed.map(({ externalKey }) => ({ externalKey, status: 'applied' })),
    );
    const carrying = checked.catalog.entries
      .filter(({ ruleValues }) => ruleValues)
      .map(({ externalKey }) => externalKey)
      .sort();
    expect(carrying).toEqual([...batchKeys].sort());
  });

  it('as committed, three checked by the record step and the Mad Dog’s drafted: the three apply, so character 3 (Cleric 8) channels 4d6 and character 12 (Paladin 4) channels 2d6 and lays on 2d6, and character 4 (Mad Dog Barbarian 8) and a Mad Dog Barbarian 10 have no damage reduction', () => {
    expect(
      committed.map(({ externalKey, status }) => [externalKey, status]),
    ).toEqual([
      [keys.madDogDamageReduction, 'drafted'],
      [keys.layOnHands, 'checked'],
      [keys.channelEnergy, 'checked'],
      [keys.channelPositiveEnergy, 'checked'],
    ]);
    expect(asCommitted.curation.ruleValues).toEqual([
      { externalKey: keys.madDogDamageReduction, status: 'drafted' },
      { externalKey: keys.layOnHands, status: 'applied' },
      { externalKey: keys.channelEnergy, status: 'applied' },
      { externalKey: keys.channelPositiveEnergy, status: 'applied' },
    ]);
    expect(
      asCommitted.catalog.entries
        .filter(({ ruleValues }) => ruleValues)
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual(
      [keys.channelEnergy, keys.channelPositiveEnergy, keys.layOnHands].sort(),
    );
    // Character 3.
    expect(dice(sheet(asCommitted, [classes.cleric, 8]))).toEqual([
      `${keys.channelEnergy}: 4d6`,
    ]);
    // Character 12.
    expect(dice(sheet(asCommitted, [classes.paladin, 4])).sort()).toEqual(
      [`${keys.channelPositiveEnergy}: 2d6`, `${keys.layOnHands}: 2d6`].sort(),
    );
    for (const result of [
      // Character 4.
      sheet(asCommitted, [classes.barbarian, 8, archetypes.madDog]),
      sheet(asCommitted, [classes.barbarian, 10, archetypes.madDog]),
    ]) {
      expect(result.featureNumbers).toEqual([]);
      expect(damageReduction(result)).toEqual({ lines: [], values: [] });
    }
  });

  it('checked: Channel Energy counts the Cleric’s active rows, so character 3 (Cleric 8) channels 4d6 and character 6 (Ecclesitheurge Cleric 5, its 3rd-level increase replaced) 2d6', () => {
    expect(dice(sheet(checked, [classes.cleric, 1]))).toEqual([
      `${keys.channelEnergy}: 1d6`,
    ]);
    // Character 3.
    expect(dice(sheet(checked, [classes.cleric, 8]))).toEqual([
      `${keys.channelEnergy}: 4d6`,
    ]);
    // Character 6 (the Monk level aside).
    expect(
      dice(sheet(checked, [classes.cleric, 5, archetypes.ecclesitheurge])),
    ).toEqual([`${keys.channelEnergy}: 2d6`]);
    expect(dice(sheet(checked, [classes.cleric, 5]))).toEqual([
      `${keys.channelEnergy}: 3d6`,
    ]);
    expect(dice(sheet(checked, [classes.cleric, 20]))).toEqual([
      `${keys.channelEnergy}: 10d6`,
    ]);
  });

  it('checked: Channel Positive Energy is ceil(paladin level / 2) d6, so character 12 (Paladin 4) channels 2d6', () => {
    const channel = (level: number) =>
      dice(sheet(checked, [classes.paladin, level])).filter((line) =>
        line.startsWith(keys.channelPositiveEnergy),
      );
    // Character 12.
    expect(channel(4)).toEqual([`${keys.channelPositiveEnergy}: 2d6`]);
    expect(channel(5)).toEqual([`${keys.channelPositiveEnergy}: 3d6`]);
    expect(channel(20)).toEqual([`${keys.channelPositiveEnergy}: 10d6`]);
    expect(channel(3)).toEqual([]);
  });

  it('checked: Lay on Hands is floor(paladin level / 2) d6, so character 12 (Paladin 4) lays on 2d6', () => {
    const layOnHands = (level: number) =>
      dice(sheet(checked, [classes.paladin, level])).filter((line) =>
        line.startsWith(keys.layOnHands),
      );
    expect(layOnHands(2)).toEqual([`${keys.layOnHands}: 1d6`]);
    // Character 12.
    expect(layOnHands(4)).toEqual([`${keys.layOnHands}: 2d6`]);
    expect(layOnHands(12)).toEqual([`${keys.layOnHands}: 6d6`]);
  });

  it('checked: the Damage Reduction the Barbarian, Unchained Barbarian and Bloodrager share gives no line, alone or multiclassed, so character 4 (Mad Dog Barbarian 8) has no damage reduction yet', () => {
    for (const result of [
      sheet(checked, [classes.barbarian, 7]),
      sheet(checked, [classes.barbarian, 20]),
      sheet(checked, [classes.unchainedBarbarian, 10]),
      sheet(checked, [classes.bloodrager, 13]),
      multiclass(checked, [
        [classes.barbarian, 10],
        [classes.bloodrager, 10],
      ]),
      // Character 4.
      sheet(checked, [classes.barbarian, 8, archetypes.madDog]),
    ])
      expect(damageReduction(result)).toEqual({ lines: [], values: [] });
  });

  it('checked: the Mad Dog’s Damage Reduction is its own line from 10th, floor((barbarian level - 7) / 3), and the statistic', () => {
    expect(
      damageReduction(
        sheet(checked, [classes.barbarian, 10, archetypes.madDog]),
      ),
    ).toEqual({
      lines: ['Damage Reduction 1/- (applies)'],
      values: ['1/-'],
    });
    expect(
      damageReduction(
        sheet(checked, [classes.barbarian, 19, archetypes.madDog]),
      ),
    ).toEqual({
      lines: ['Damage Reduction 4/- (applies)'],
      values: ['4/-'],
    });
  });

  it('checked: a Cleric 5 / Paladin 4 keeps each class’s dice its own on the real rows: 3d6 and 2d6 channels, 2d6 lay on hands', () => {
    expect(
      dice(
        multiclass(checked, [
          [classes.cleric, 5],
          [classes.paladin, 4],
        ]),
      ).sort(),
    ).toEqual(
      [
        `${keys.channelEnergy}: 3d6`,
        `${keys.channelPositiveEnergy}: 2d6`,
        `${keys.layOnHands}: 2d6`,
      ].sort(),
    );
  });
});
