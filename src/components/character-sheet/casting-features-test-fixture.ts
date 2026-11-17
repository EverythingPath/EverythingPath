import type { Id } from '@convex/_generated/dataModel';
import { representativeArchetypeCatalog } from '@convex/lib/representativeArchetypeCatalog';
import {
  representativeClassCatalog,
  representativeClassFeatureSchedules,
} from '@convex/lib/representativeClassCatalog';
import { representativeGrantedSpellCatalog } from '@convex/lib/representativeSpellcastingCatalog';
import {
  defaultAbilityScores,
  type AbilityScores,
  type SheetWarning,
} from '~/lib/character-sheet';
import {
  buildSheet,
  calculateFixtureSheetProjections,
  characterId,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';

type Entry = CharacterSheetSnapshot['entries'][number];
type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
type Advance = { classEntryId: string | null };
export type CastingLevel = string | [string, Advance[]];
export type CastingSelection = {
  id: string;
  catalogEntryId: string;
  /** The class and its prompt-owning feature, such as cleric Domains. */
  classIdentity: string;
  feature: string;
  list: string;
  oppositionSchools?: string[];
};
/** A recorded Spell from the representative list, by its catalog key. */
export type CastingRecorded = {
  id: string;
  spell: string;
  castingClassId: string;
  level?: number | null;
};
/** A representative Archetype Selection (#422), with its saved casting choices. */
export type CastingArchetype = {
  key: string;
  choices?: string[];
  active?: boolean;
};

/**
 * A read snapshot over the prepared representative classes, casting features
 * and Granted Spells: Class Levels in order (ids `<class>-<level>`) plus
 * domain, school and bloodline Selections and recorded Spells.
 */
export function buildCastingSheet({
  levels,
  selections = [],
  recorded = [],
  archetypes = [],
  scores = {},
  accepted = [],
  lastOperationId = 'seed',
}: {
  levels: CastingLevel[];
  selections?: CastingSelection[];
  recorded?: CastingRecorded[];
  archetypes?: CastingArchetype[];
  scores?: Partial<AbilityScores>;
  accepted?: Pick<SheetWarning, 'check' | 'subject' | 'fingerprint'>[];
  lastOperationId?: string;
}): CharacterSheetSnapshot {
  const seed = buildSheet({
    accepted,
    lastOperationId,
    scores: { ...defaultAbilityScores, ...scores },
  });
  const definitions = [
    ...representativeClassCatalog.map((definition) => ({
      ...definition,
      _id: definition.ruleIdentity,
      detail: {
        ...definition.detail,
        featuresByLevel:
          representativeClassFeatureSchedules[definition.ruleIdentity] ?? [],
      },
    })),
    ...representativeArchetypeCatalog.map((definition) => ({
      ...definition,
      stacksWithItself: false,
    })),
    ...representativeGrantedSpellCatalog.map((definition) => ({
      ...definition,
      _id: definition.ruleIdentity,
    })),
  ].map(
    (definition) =>
      ({
        ...definition,
        _creationTime: 3,
        scope: 'character',
        characterId,
      }) as unknown as CatalogEntry,
  );
  const counts = new Map<string, number>();
  const classLevels = levels.map((level, index) => {
    const [classEntryId, castingAdvances] =
      typeof level === 'string' ? [level, undefined] : level;
    const count = (counts.get(classEntryId) ?? 0) + 1;
    counts.set(classEntryId, count);
    return {
      _id: `${classEntryId}-${count}`,
      _creationTime: 4,
      characterId,
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId,
        position: index + 1,
        hpGained: 4,
        ...(castingAdvances ? { castingAdvances } : {}),
      },
    } as unknown as Entry;
  });
  const chosen = selections.map(
    (selection) =>
      ({
        _id: selection.id,
        _creationTime: 5,
        characterId,
        kind: 'classFeature',
        active: true,
        catalogEntryId: selection.catalogEntryId,
        selectionSource: {
          kind: 'prompt',
          source: {
            kind: 'grant',
            grantKey: {
              source: selection.classIdentity,
              classLevel: 1,
              entry: selection.feature,
            },
          },
          list: selection.list,
          classLevel: 1,
        },
        state: {
          kind: 'classFeature',
          ...(selection.oppositionSchools
            ? { oppositionSchools: selection.oppositionSchools }
            : {}),
        },
      }) as unknown as Entry,
  );
  const spells = recorded.map(
    (row) =>
      ({
        _id: row.id,
        _creationTime: 6,
        characterId,
        kind: 'spell',
        active: true,
        catalogEntryId: `representative-spell-${row.spell}`,
        state: {
          kind: 'spell',
          castingClassId: row.castingClassId,
          ...(row.level != null ? { level: row.level } : {}),
        },
      }) as unknown as Entry,
  );
  const selectedArchetypes = archetypes.map(
    (row, index) =>
      ({
        _id: `${row.key}-row`,
        _creationTime: 7 + index,
        characterId,
        kind: 'archetype',
        active: row.active ?? true,
        catalogEntryId: row.key,
        state: {
          kind: 'archetype',
          ...(row.choices ? { castingChoices: row.choices } : {}),
        },
      }) as unknown as Entry,
  );
  const entries = [
    ...seed.entries.filter((entry) => entry.kind === 'base'),
    ...classLevels,
    ...chosen,
    ...spells,
    ...selectedArchetypes,
  ];
  const catalogEntries = [
    ...seed.catalogEntries.filter((entry) => entry.detail.kind === 'base'),
    ...definitions,
  ];
  const calculated = calculateFixtureSheetProjections({
    characterKind: 'pc',
    entries,
    catalogEntries,
  });
  return {
    ...seed,
    entries,
    catalogEntries,
    calculated: calculated.current,
    permanentCalculated: calculated.permanent,
  };
}

export const castingId = (id: string) => id as Id<'catalogEntry'>;
export const entryId = (id: string) => id as Id<'characterSheetEntry'>;
