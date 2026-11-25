import { representativeClassFeatureSchedules } from '@convex/lib/representativeClassCatalog';
import {
  buildSheet,
  calculateFixtureSheetProjections,
  findCalculatedWarning,
  seededClassDefinitions,
  withClasses,
  type Accepted,
  type ClassKey,
  type ExtraClass,
  type Level,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// The seeded CRB Fighter and the Catalog Copies of it a user can make in the
// app (#583): the campaign's Customize copy and a homebrew copy saved
// through the definition editor. No invented rules content.

type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
type Entry = CharacterSheetSnapshot['entries'][number];

/** The campaign's Customize copy of the seeded Fighter: the same fields. */
export const campaignFighter: ExtraClass = {
  id: 'fighter-campaign',
  name: 'Fighter',
  copy: { scope: 'campaign', campaignPreference: true },
};

/**
 * The Character's homebrew Fighter, saved through the definition editor
 * with a d12 Hit Die, a half BAB and no Bravery.
 */
export const homebrewFighter: ExtraClass = {
  id: 'fighter-homebrew',
  name: 'Fighter',
  copy: { scope: 'character' },
  detail: {
    hitDie: 12,
    bab: 'half',
    featuresByLevel: (representativeClassFeatureSchedules.fighter ?? []).filter(
      (row) => row.catalogEntryId !== 'fighter-bravery-2',
    ),
  },
};

export const twoFighterLevels: Level[] = [
  { id: 'a', hp: 10, classId: 'fighter' },
  { id: 'b', hp: 12, classId: 'fighter' },
];

export type FighterVersionSheetOptions = {
  levels?: Level[];
  copies?: ExtraClass[];
  /** Entry ID to class ID: the levels moved onto a copy. */
  classOf?: Record<string, string>;
  accepted?: Accepted[];
  lastOperationId?: string;
};

/**
 * Fighter levels on the seeded Fighter (with its feature schedule) or one
 * of its copies, Bravery with a note recorded on it so it is listed when it
 * stops counting, and the sheet recalculated.
 */
export function fighterVersionSheet({
  levels = twoFighterLevels,
  copies = [campaignFighter],
  classOf = {},
  accepted,
  lastOperationId,
}: FighterVersionSheetOptions = {}): CharacterSheetSnapshot {
  const base = buildSheet({ levels, accepted, lastOperationId });
  const seeded = seededClassDefinitions(['fighter']).map(
    (definition) => ({ ...definition, scope: 'global' }) as CatalogEntry,
  );
  const sheet = withClasses(
    {
      ...base,
      catalogEntries: [
        ...base.catalogEntries.filter((entry) => entry._id !== 'fighter'),
        ...seeded,
      ],
    },
    copies,
    classOf,
  );
  const bravery = {
    _id: 'bravery-state',
    _creationTime: 60,
    characterId: sheet.character._id,
    kind: 'classFeature',
    active: true,
    catalogEntryId: 'fighter-bravery-2',
    grantKey: { source: 'fighter', classLevel: 2, entry: 'fighter-bravery-2' },
    notes: 'Fearless',
    state: { kind: 'classFeature' },
  } as unknown as Entry;
  const entries = [...sheet.entries, bravery];
  const calculated = calculateFixtureSheetProjections({
    characterKind: 'pc',
    entries,
    catalogEntries: sheet.catalogEntries,
  });
  return {
    ...sheet,
    entries,
    calculated: calculated.current,
    permanentCalculated: calculated.permanent,
  };
}

/** The campaign's Customize copy of the seeded Rogue: the same fields. */
export const campaignRogue: ExtraClass = {
  id: 'rogue-campaign',
  name: 'Rogue',
  like: 'rogue',
  copy: { scope: 'campaign', campaignPreference: true },
};

/**
 * The campaign's copy of the seeded Unchained Rogue, saved to the campaign
 * catalog without making it the campaign's preference. The seeded Unchained
 * Rogue is not one of the fixture's representative classes, hence the cast.
 */
export const campaignUnchainedRogue: ExtraClass = {
  id: 'unchained-rogue-campaign',
  name: 'Rogue (Unchained)',
  like: 'unchained-rogue' as ClassKey,
  copy: { scope: 'campaign' },
};

export const twoRogueLevels: Level[] = [
  { id: 'a', hp: 8, classId: 'rogue' },
  { id: 'b', hp: 7, classId: 'rogue' },
];

/**
 * Rogue levels on the seeded Rogue, its seeded Unchained version (both from
 * the global catalog, with their feature schedules) or a copy of either,
 * and the sheet recalculated.
 */
export function rogueVersionSheet({
  levels = twoRogueLevels,
  copies = [],
  classOf = {},
  accepted,
  lastOperationId,
}: FighterVersionSheetOptions = {}): CharacterSheetSnapshot {
  const base = buildSheet({ levels, accepted, lastOperationId });
  const seeded = seededClassDefinitions(['rogue', 'unchained-rogue']).map(
    (definition) => ({ ...definition, scope: 'global' }) as CatalogEntry,
  );
  return withClasses(
    {
      ...base,
      catalogEntries: [
        ...base.catalogEntries.filter((entry) => entry._id !== 'rogue'),
        ...seeded,
      ],
    },
    copies,
    classOf,
  );
}

/** The sheet's HP warning as it states it, to accept it. */
export function fighterHpWarning(options: FighterVersionSheetOptions = {}) {
  return findCalculatedWarning(
    fighterVersionSheet(options),
    'hpGainedAboveMaximum',
  );
}

/** The same sheet with its HP warning accepted as it states it. */
export function fighterSheetWithAcceptedHp(
  options: FighterVersionSheetOptions = {},
) {
  return fighterVersionSheet({
    ...options,
    accepted: [fighterHpWarning(options)],
  });
}
