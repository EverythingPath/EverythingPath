// The rule-value record tests' shared seam (PRD #251; GLOSSARY: Rule value):
// the pinned tree's Barbarian, Bloodrager, Cleric and Paladin rows, imported
// with a chosen set of rule-value records, and Characters of given class
// levels calculated from them. Used by rule-values-d1.test.ts and
// rule-values-dr.test.ts.
import { readFile } from 'node:fs/promises';
import type { RuleValueRecord } from '../../scripts/catalog/curation';
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
  formatGrantKeyId,
  parseGrantKeyId,
  type GrantKey,
} from '../../src/lib/character-sheet-grants';
import {
  ownerEmissionFoundryFiles,
  pcgenOwnerEmissionFiles,
} from '../fixtures/pcgen-716/owner-emission-files';
import { materializePinnedTree } from './pinned-sources';

export const keys = {
  channelEnergy: 'pf1/kXXz1lO4i7CibHJ9',
  channelPositiveEnergy: 'pf1/tHObxrPeyhimmz9V',
  layOnHands: 'pf1/WhE4j0Jc82npdMCP',
  damageReduction: 'pf1/RENIeTVjWB7Mq6Mw',
  madDogDamageReduction: 'everythingpath/barbarian-mad-dog-damage-reduction',
} as const;
export const classes = {
  cleric: 'pf1/SjFqQceVeVBzBwgn',
  paladin: 'pf1/ohptcds1d5oG6Bjh',
  barbarian: 'pf1/g3pq7xWWdUVYw6ai',
  unchainedBarbarian: 'pf1/W3EjUgYLJ1D9qDKw',
  bloodrager: 'pf1/E27lMw9YNOAjS009',
} as const;
export const archetypes = {
  ecclesitheurge: 'everythingpath/cleric-ecclesitheurge',
  madDog: 'everythingpath/barbarian-mad-dog',
} as const;

/** The committed rule-value records of these entries, in overlay order. */
export const committedRecords = (entryKeys: ReadonlySet<string>) =>
  (reviewedCuration.ruleValues ?? []).filter(({ externalKey }) =>
    entryKeys.has(externalKey),
  );

/** The records as the batch wrote them, whatever the record step has done since. */
export const asDrafted = (records: readonly RuleValueRecord[]) =>
  records.map(
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

/** The records checked in memory under a placeholder receipt. */
export const asChecked = (records: readonly RuleValueRecord[], by: string) =>
  asDrafted(records).map(
    (record): RuleValueRecord => ({
      ...record,
      status: 'checked',
      reviewedBy: `in-memory check (${by})`,
      reviewedOn: '2026-11-17',
      receipt: `t3-review-${'0'.repeat(64)}`,
    }),
  );

/** One import of the pinned tree with only the given rule-value records (none: the overlay without the collection). */
export type Emit = (
  ruleValues?: readonly RuleValueRecord[],
) => ReturnType<typeof importCatalog>;

/**
 * Runs `use` with imports of the pinned tree's classes with the Ecclesitheurge
 * and the Mad Dog. The tree lives only while `use` runs and is removed however
 * it ends, a failed import included.
 */
async function withRuleValueImports<Result>(
  use: (emit: Emit) => Promise<Result>,
): Promise<Result> {
  const remaps: unknown = JSON.parse(
    await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
  );
  const selection = pcgenOwnerSelection.filter(
    ({ key }) =>
      key === 'Cleric Archetype ~ Ecclesitheurge' ||
      key === 'Barbarian Archetype ~ Mad Dog',
  );
  const { ruleValues: _committed, ...overlay } = reviewedCuration;
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
  try {
    return await use((ruleValues) =>
      importCatalog({
        systemPath: tree.systemPath,
        contentPath: tree.contentPath,
        remaps,
        curation: ruleValues ? { ...overlay, ruleValues } : overlay,
        pcgen: { path: tree.pcgenPath, selection },
        wholeCorpus: false,
      }),
    );
  } finally {
    await tree.dispose();
  }
}

export type Artifact = Awaited<ReturnType<typeof importCatalog>>;

/**
 * The pinned tree imported four ways with these committed records: without
 * the collection, the records drafted, checked in memory (`by` names the
 * checking test), and as committed.
 */
export const ruleValueImports = (
  committed: readonly RuleValueRecord[],
  by: string,
) =>
  withRuleValueImports(async (emit) => ({
    without: await emit(),
    drafted: await emit(asDrafted(committed)),
    checked: await emit(asChecked(committed, by)),
    asCommitted: await emit(committed),
  }));

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

export type ClassLevels = readonly (readonly [
  classKey: string,
  level: number,
])[];

/** What a Character has beside its class levels. */
export type CharacterOptions = {
  archetype?: string;
  /** Grants the player has switched off, each recorded inactive. */
  switchedOff?: readonly GrantKey[];
};

/** A Character of these levels, class by class. */
function character(
  artifact: Artifact,
  levels: ClassLevels,
  { archetype, switchedOff = [] }: CharacterOptions = {},
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
    ...switchedOff.map(
      (grantKey): SheetEntry => ({
        _id: `off-${formatGrantKeyId(grantKey)}`,
        kind: 'classFeature',
        active: false,
        catalogEntryId: grantKey.entry,
        grantKey,
        state: { kind: 'classFeature' },
      }),
    ),
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

/** A single-class Character's sheet, with an archetype or none. */
export const sheet = (
  artifact: Artifact,
  [classKey, level, archetype]: readonly [string, number, string?],
) =>
  calculateCharacterSheet(
    character(artifact, [[classKey, level]], { archetype }),
  );
/** A Character's sheet, of one class or several. */
export const characterSheet = (
  artifact: Artifact,
  levels: ClassLevels,
  options?: CharacterOptions,
) => calculateCharacterSheet(character(artifact, levels, options));

type Sheet = ReturnType<typeof calculateCharacterSheet>;

/** Each sheet entry's Catalog Entry key, by sheet entry. */
const catalogKeys = (result: Sheet) =>
  new Map(
    result.resolvedEntries.map(({ entry }) => [
      entry._id,
      'catalogEntryId' in entry ? entry.catalogEntryId : entry._id,
    ]),
  );

/** Each dice feature number as "<entry>: <count>d<die>". */
export function dice(result: Sheet) {
  const names = catalogKeys(result);
  return result.featureNumbers.map(
    ({ entryId, count, die }) => `${names.get(entryId)}: ${count}d${die}`,
  );
}

/** The Grant a sheet entry is; every damage reduction line here comes from one. */
function grantOf(entryId: string) {
  const grant = parseGrantKeyId(entryId, { requireComplete: true });
  if (!grant) throw new Error(`${entryId} is not a Grant`);
  return grant;
}

/**
 * The damage reduction lines, each with the Grant that gave it (its source,
 * the source's class level and the granted entry), its value and bypass and
 * whether it applies, and the statistic, each value with its line's Grant, as
 * the Defenses block reads them.
 */
export function damageReduction(result: Sheet) {
  return {
    lines: result.damageReduction.lines.map(
      ({ entryId, value, bypass, applies }) => ({
        grant: grantOf(entryId),
        value,
        bypass,
        applies,
      }),
    ),
    values: result.damageReduction.values.map(({ entryId, value, bypass }) => ({
      grant: grantOf(entryId),
      value,
      bypass,
    })),
  };
}
