import type { Id } from '@convex/_generated/dataModel';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  defaultAbilityScores,
  type Ability,
  type AbilityScores,
  type CharacterSheetCatalogEntry,
  type CharacterSheetRacialProgression,
  type FavoredClassBonus,
  type ItemMagic,
  type Modifier,
  type SheetWarning,
} from '~/lib/character-sheet';
import {
  UNARMED_STRIKE_ID,
  isUnarmedStrike,
} from '~/lib/character-sheet-attack-types';
import { representativeArchetypeCatalog } from '@convex/lib/representativeArchetypeCatalog';
import {
  representativeAdditionalClassFeatures,
  representativeClassCatalog as seededClassCatalog,
  representativeClassCounterparts,
  representativeClassFeatureSchedules,
} from '@convex/lib/representativeClassCatalog';
import {
  representativeEquipmentCatalog,
  representativeItemAbilityCatalog,
} from '@convex/lib/representativeItemCatalog';
import { representativeRaceCatalog } from '@convex/lib/representativeRaceCatalog';
import { representativeSelectionCatalog } from '@convex/lib/representativeSelectionCatalog';
import { representativeWeaponCatalog } from '@convex/lib/representativeWeaponCatalog';
import type {
  ManualProficiency,
  ProficiencyGrant,
} from '~/lib/character-sheet-proficiencies';
import { representativeClassCatalog } from '../../../tests/fixtures/catalog/representative-class-progressions';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// A read snapshot for the living sheet's component tests: base scores, Class
// Levels with their choices, the representative classes, personal
// adjustments and accepted warnings, calculated by the public resolver.

export const characterId = 'character-1' as Id<'character'>;
// The campaign row calls the owner-candidate hook even while its picker is
// closed. Tests of other sheet controls keep that skipped query empty.
export function emptyOwnerCandidates() {
  return {
    results: [],
    status: 'Exhausted' as const,
    loadMore: () => undefined,
  };
}

export type ClassKey = (typeof representativeClassCatalog)[number]['_id'];
export type Level = {
  id: string;
  hp: number | null;
  classId?: ClassKey | null;
  favoredClassBonus?: FavoredClassBonus | null;
  abilityIncrease?: Ability | null;
  skillRanks?: Record<string, number>;
  proficiencyChoice?: string | null;
};
export type Adjustment = {
  id: string;
  name: string;
  active?: boolean;
  modifiers: Modifier[];
  /** The Class Level this selection was gained at, which may be gone. */
  gainedAtClassLevel?: string;
};
export type AbilityChange = {
  id: string;
  kind: 'abilityDamage' | 'abilityDrain';
  ability: Ability;
  points: number;
  active?: boolean;
};
type Entry = CharacterSheetSnapshot['entries'][number];
type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
export function isClassCatalogEntry(
  entry: CatalogEntry,
): entry is Extract<CatalogEntry, { detail: { kind: 'class' } }> {
  return entry.detail.kind === 'class';
}
export type SheetEntryDetail = Extract<
  CatalogEntry['detail'],
  { kind: 'spellEffect' | 'condition' | 'item' | 'spell' }
>;
export type CatalogSheetEntry = {
  id: string;
  name: string;
  detail: SheetEntryDetail;
  modifiers: Modifier[];
  /** A Spell Effect's recorded caster level; the default when absent. */
  casterLevel?: number;
  /** A Spell Effect's recorded target: a Gear entry or the unarmed strike. */
  onItem?: { entry: string; end?: 'otherEnd' | 'bash' };
  active?: boolean;
  /**
   * An item's recorded gear state: enhancement, masterwork, material and
   * Item Abilities, with a double weapon's other end and a shield's bash
   * recorded apart. Abilities refer to `itemAbilities` by rule identity.
   */
  itemState?: ItemMagic;
};
export type ItemAbilityKey =
  (typeof representativeItemAbilityCatalog)[number]['ruleIdentity'];
export type Accepted = Pick<SheetWarning, 'check' | 'subject' | 'fingerprint'>;
/** A recorded Attack Routine, naming the Gear entry it attacks with. */
export type AttackRoutineFixture = {
  id: string;
  name: string;
  weaponEntryId: string;
  hands?: 'one' | 'two';
  mode?: 'melee' | 'ranged' | 'thrown';
  naturalAttackEntryIds?: string[];
  availableLimbs?: number;
  /** A second Gear weapon or the other end of a double main weapon. */
  offHand?:
    | {
        kind: 'weapon';
        weaponEntryId: string;
        mode: 'melee' | 'ranged' | 'thrown';
      }
    | { kind: 'otherEnd'; mode: 'melee' | 'ranged' | 'thrown' };
  /** The Gear ammunition a ranged routine fires; may name a row that is gone. */
  ammunitionEntryId?: string;
  rangeIncrements?: number;
  /** Switched-on Routine Options: a feat's `${id}-catalog` definition. */
  options?: string[];
  revision?: number;
  deleted?: boolean;
};
/** A feat Selection on the sheet, by the representative selection catalog. */
export type FeatFixture = {
  id: string;
  key: (typeof representativeSelectionCatalog)[number]['ruleIdentity'];
  active?: boolean;
  /** Rapid Reload's chosen crossbow type. */
  choice?: string;
};
export type Race = {
  /** A representative race, or one from `extraCatalog`. */
  key: string;
  id?: string;
  active?: boolean;
  /** Racial Hit Dice on the definition; the representative races have none. */
  hitDice?: number;
  /** The definition's racial Hit Dice progression, when it has one. */
  progression?: CharacterSheetRacialProgression;
  racialHpGained?: number | null;
  racialSkillRanks?: Record<string, number>;
};
export type RacialTrait = {
  id: string;
  /** A representative trait, or one from `extraCatalog`. */
  key: string;
  active?: boolean;
  /** Recorded state of a race-granted trait rather than a Selection. */
  grantKey?: { source: string; entry: string };
  choice?: string | null;
  secondChoice?: Ability | null;
  replaces?: string[];
  notes?: string;
  kept?: boolean;
};

function entryState(entry: CatalogSheetEntry) {
  if (entry.detail.kind === 'item') return { kind: 'item', ...entry.itemState };
  if (entry.detail.kind !== 'spellEffect') return { kind: entry.detail.kind };
  return {
    kind: 'spellEffect',
    casterLevel: entry.casterLevel ?? entry.detail.defaultCasterLevel,
    ...(entry.onItem ? { onItem: entry.onItem } : {}),
  };
}

/** A representative Base Item weapon as a Gear entry (or catalog choice). */
export function representativeWeapon(
  ruleIdentity: (typeof representativeWeaponCatalog)[number]['ruleIdentity'],
  id: string,
  overrides: Partial<CatalogSheetEntry> = {},
): CatalogSheetEntry {
  const definition = representativeWeaponCatalog.find(
    (entry) => entry.ruleIdentity === ruleIdentity,
  );
  if (!definition) throw new Error(`Missing ${ruleIdentity}`);
  return {
    id,
    name: definition.name,
    detail: structuredClone(definition.detail) as unknown as SheetEntryDetail,
    modifiers: [],
    ...overrides,
  };
}

/** A representative armor or shield Base Item as a Gear entry. */
export function representativeEquipment(
  ruleIdentity: string,
  id: string,
): CatalogSheetEntry {
  const definition = representativeEquipmentCatalog.find(
    (entry) => entry.ruleIdentity === ruleIdentity,
  );
  if (!definition) throw new Error(`Missing ${ruleIdentity}`);
  return {
    id,
    name: definition.name,
    detail: structuredClone(definition.detail) as SheetEntryDetail,
    modifiers: [],
  };
}

/**
 * The seeded core and Unchained monks with their feature schedules (CRB
 * Table 3–10; Pathfinder Unchained p. 14), so a Class Level of `monk` or
 * `unchained-monk` grants its Flurry of Blows (#414). Pass as
 * `extraCatalog` with `hasRaces`.
 */
export function monkClassCatalog(): CharacterSheetCatalogEntry[] {
  return seededClassDefinitions(['monk', 'unchained-monk']);
}

/**
 * Seeded classes with their feature schedules and the features they grant:
 * the Fighter's bonus feats and Bravery, the Monk's Flurry of Blows. The
 * classes come first, keyed by rule identity like the representative ones.
 */
export function seededClassDefinitions(
  identities: string[],
): CharacterSheetCatalogEntry[] {
  const classes = seededClassCatalog
    .filter((definition) => identities.includes(definition.ruleIdentity))
    .map((definition) => ({
      ...definition,
      _id: definition.ruleIdentity,
      detail: {
        ...definition.detail,
        counterpartOf: representativeClassCounterparts[definition.ruleIdentity],
        featuresByLevel:
          representativeClassFeatureSchedules[definition.ruleIdentity] ?? [],
      },
    }));
  const features = [
    ...representativeAdditionalClassFeatures,
    ...representativeArchetypeCatalog.filter(
      (seed) => seed.detail?.kind === 'classFeature',
    ),
  ].filter((feature) =>
    identities.some((identity) =>
      feature.ruleIdentity.startsWith(`${identity}-`),
    ),
  );
  return [...classes, ...features] as CharacterSheetCatalogEntry[];
}

type ClassDefinition = Extract<CatalogEntry, { detail: { kind: 'class' } }>;
/** A class shaped like a representative one: a Prestige Class or a version. */
export type ExtraClass = {
  id: string;
  name: string;
  /** The representative class it copies, Fighter unless named. */
  like?: ClassKey;
  classKind?: 'base' | 'prestige';
  /** The original class this is the Unchained version of. */
  counterpartOf?: string;
  prerequisites?: unknown[];
  prerequisiteText?: string;
  /** Class detail that differs from the copied class, such as its features. */
  detail?: Record<string, unknown>;
  /**
   * A Catalog Copy of the class it is like (#583): the same rule identity,
   * in the campaign's catalog (Customize, with `campaignPreference`) or the
   * Character's own (Detach, or homebrew saved through the editor).
   */
  copy?: { scope: 'campaign' | 'character'; campaignPreference?: true };
};

function copyOwner(
  snapshot: CharacterSheetSnapshot,
  copy: NonNullable<ExtraClass['copy']>,
) {
  if (copy.scope === 'campaign')
    return {
      scope: 'campaign',
      campaignId: snapshot.character.campaignId,
      characterId: undefined,
      ...(copy.campaignPreference ? { campaignPreference: true } : {}),
    };
  return { scope: 'character', characterId: snapshot.character._id };
}

/**
 * The sheet with further class definitions, some of its Class Levels moved
 * onto them (`classOf`: entry ID to class ID), and the sheet recalculated.
 */
export function withClasses(
  snapshot: CharacterSheetSnapshot,
  classes: ExtraClass[],
  classOf: Record<string, string> = {},
): CharacterSheetSnapshot {
  const definitions = classes.map((extra) => {
    const like = snapshot.catalogEntries.find(
      (entry): entry is ClassDefinition =>
        isClassCatalogEntry(entry) && entry._id === (extra.like ?? 'fighter'),
    );
    if (!like) throw new Error(`Missing ${extra.like ?? 'fighter'}`);
    return {
      ...like,
      _id: extra.id,
      name: extra.name,
      ruleIdentity: extra.copy ? like.ruleIdentity : extra.id,
      ...(extra.copy
        ? { copiedFrom: like._id, ...copyOwner(snapshot, extra.copy) }
        : {}),
      detail: {
        ...like.detail,
        ...(extra.classKind ? { classKind: extra.classKind } : {}),
        ...(extra.counterpartOf ? { counterpartOf: extra.counterpartOf } : {}),
        ...extra.detail,
      },
      ...(extra.prerequisites ? { prerequisites: extra.prerequisites } : {}),
      ...(extra.prerequisiteText
        ? { prerequisiteText: extra.prerequisiteText }
        : {}),
    } as unknown as CatalogEntry;
  });
  const catalogEntries = [...snapshot.catalogEntries, ...definitions];
  const entries = snapshot.entries.map((entry) =>
    entry.kind === 'classLevel' && classOf[entry._id] !== undefined
      ? ({
          ...entry,
          state: {
            ...entry.state,
            classEntryId: classOf[entry._id] as Id<'catalogEntry'>,
          },
        } as Entry)
      : entry,
  );
  const calculated = calculateFixtureSheetProjections({
    characterKind: 'pc',
    entries,
    catalogEntries,
  });
  return {
    ...snapshot,
    entries,
    catalogEntries,
    calculated: calculated.current,
    permanentCalculated: calculated.permanent,
  };
}

/** The calculated warning for one check, to accept it as the sheet states it. */
export function findCalculatedWarning(
  snapshot: CharacterSheetSnapshot,
  check: SheetWarning['check'],
  subject?: string,
) {
  const warning = snapshot.calculated.warnings.find(
    (candidate) =>
      candidate.check === check &&
      (subject === undefined || candidate.subject === subject),
  );
  if (!warning) throw new Error(`Expected a ${check} warning`);
  return warning;
}

type FixtureSheetInput = Omit<
  Parameters<typeof calculateCharacterSheet>[0],
  'entries'
> & {
  entries: CharacterSheetSnapshot['entries'];
};

export function storedAttackReferences(
  calculated: ReturnType<typeof calculateCharacterSheet>,
  entries: CharacterSheetSnapshot['entries'],
): CharacterSheetSnapshot['calculated'] {
  return {
    ...calculated,
    // The read hands Item Ability references back as Catalog Entry IDs.
    itemParts: calculated.itemParts.map((item) => ({
      ...item,
      parts: item.parts.map((part) => ({
        ...part,
        abilities: part.abilities.map((ability) => ({
          ...ability,
          catalogEntryId: ability.catalogEntryId as Id<'catalogEntry'>,
        })),
      })),
    })),
    attackRoutines: calculated.attackRoutines.map((routine) => {
      const { offHand, ...fields } = routine;
      if (!offHand || offHand.kind === 'otherEnd')
        return { ...fields, ...(offHand ? { offHand } : {}) };
      const stored = entries.find((entry) => entry._id === routine.entryId);
      const retained =
        stored?.kind === 'attackRoutine' ? stored.state.offHand : undefined;
      if (
        retained?.kind !== 'weapon' ||
        retained.weaponEntryId !== offHand.weaponEntryId
      )
        throw new Error(
          'Calculated off-hand reference does not match its stored routine',
        );
      return isUnarmedStrike(retained.weaponEntryId)
        ? {
            ...fields,
            offHand: { ...retained, weaponEntryId: UNARMED_STRIKE_ID },
          }
        : {
            ...fields,
            offHand: { ...retained, weaponEntryId: retained.weaponEntryId },
          };
    }),
  };
}

/** Match the read DTO using the routine's typed reference, even when Gear is missing. */
export function calculateFixtureSheet(
  input: FixtureSheetInput,
  options?: Parameters<typeof calculateCharacterSheet>[1],
) {
  return storedAttackReferences(
    calculateCharacterSheet(input, options),
    input.entries,
  );
}

export function calculateFixtureSheetProjections(
  input: FixtureSheetInput,
  options?: Parameters<typeof calculateCharacterSheetProjections>[1],
) {
  const projections = calculateCharacterSheetProjections(input, options);
  return {
    current: storedAttackReferences(projections.current, input.entries),
    permanent: storedAttackReferences(projections.permanent, input.entries),
  };
}

export function buildSheet({
  scores = defaultAbilityScores,
  levels = [{ id: 'level-1', hp: null }],
  adjustments = [],
  abilityChanges = [],
  sheetEntries = [],
  hasClasses = levels.some((level) => level.classId),
  favoredClassIds = [],
  accepted = [],
  lastOperationId = 'seed',
  name = 'Kesh',
  race,
  racialTraits = [],
  extraCatalog = [],
  hasRaces = race !== undefined || racialTraits.length > 0,
  classProficiencies = {},
  manualProficiencies,
  attackRoutines = [],
  feats = [],
  catalogOnly = [],
  itemAbilities = [],
}: {
  scores?: AbilityScores;
  levels?: Level[];
  adjustments?: Adjustment[];
  abilityChanges?: AbilityChange[];
  sheetEntries?: CatalogSheetEntry[];
  hasClasses?: boolean;
  favoredClassIds?: ClassKey[];
  accepted?: Accepted[];
  lastOperationId?: string;
  name?: string;
  race?: Race;
  racialTraits?: RacialTrait[];
  /** Further definitions keyed like the representative ones. */
  extraCatalog?: CharacterSheetCatalogEntry[];
  hasRaces?: boolean;
  /** The Proficiencies a representative class grants at its first level. */
  classProficiencies?: Partial<Record<ClassKey, ProficiencyGrant[]>>;
  /** The table's own additions and removals, recorded on the base entry. */
  manualProficiencies?: {
    added: ManualProficiency[];
    removed: ManualProficiency[];
  };
  attackRoutines?: AttackRoutineFixture[];
  /** Feat Selections, such as Point-Blank Shot or Rapid Reload. */
  feats?: FeatFixture[];
  /** Definitions the Character can add but does not have yet. */
  catalogOnly?: CatalogSheetEntry[];
  /** Representative Item Abilities on offer, as definitions keyed by rule identity. */
  itemAbilities?: ItemAbilityKey[];
} = {}): CharacterSheetSnapshot {
  const campaignId = 'campaign-1' as Id<'campaign'>;
  const baseCatalog: CharacterSheetSnapshot['baseScoresEntry'] = {
    _id: 'base-catalogEntry' as Id<'catalogEntry'>,
    _creationTime: 1,
    scope: 'character',
    characterId,
    name: 'Base scores',
    ruleIdentity: 'base',
    stacksWithItself: false,
    detail: { kind: 'base' },
    sources: [],
    modifiers: abilityKeys.map((ability) => ({
      target: abilityTargets[ability],
      bonusType: 'base' as const,
      value: scores[ability],
    })),
  };
  const classCatalogs = hasClasses
    ? representativeClassCatalog.map(
        (entry) =>
          ({
            ...entry,
            ...(classProficiencies[entry._id]
              ? { proficiencies: classProficiencies[entry._id] }
              : {}),
            _creationTime: 3,
            scope: 'character',
            characterId,
            stacksWithItself: false,
            sources: [],
          }) as unknown as CatalogEntry,
      )
    : [];
  const raceCatalogs = hasRaces
    ? [...representativeRaceCatalog, ...extraCatalog].map(
        (entry) =>
          ({
            ...entry,
            ...(entry._id === race?.key &&
            (race.hitDice !== undefined || race.progression)
              ? {
                  detail: {
                    ...entry.detail,
                    ...(race.hitDice !== undefined
                      ? { racialHitDice: race.hitDice }
                      : {}),
                    ...(race.progression
                      ? { racialProgression: race.progression }
                      : {}),
                  },
                }
              : {}),
            _creationTime: 4,
            scope: 'character',
            characterId,
            stacksWithItself: false,
          }) as unknown as CatalogEntry,
      )
    : [];
  const adjustmentCatalogs = adjustments.map(
    (adjustment) =>
      ({
        _id: `${adjustment.id}-catalog` as Id<'catalogEntry'>,
        _creationTime: 5,
        scope: 'character',
        characterId,
        name: adjustment.name,
        ruleIdentity: `manual:${adjustment.id}`,
        stacksWithItself: false,
        detail: { kind: 'manual' },
        sources: [],
        modifiers: adjustment.modifiers,
      }) as unknown as CatalogEntry,
  );
  const entryCatalogs = [...sheetEntries, ...catalogOnly].map(
    (entry) =>
      ({
        _id: `${entry.id}-catalog` as Id<'catalogEntry'>,
        _creationTime: 6,
        scope: 'character',
        characterId,
        name: entry.name,
        ruleIdentity: `entry:${entry.id}`,
        stacksWithItself: false,
        detail: entry.detail,
        sources: [],
        modifiers: entry.modifiers,
      }) as unknown as CatalogEntry,
  );
  const abilityCatalogs = itemAbilities.map((key) => {
    const definition = representativeItemAbilityCatalog.find(
      (entry) => entry.ruleIdentity === key,
    );
    if (!definition) throw new Error(`Missing ${key}`);
    return {
      ...definition,
      _id: key as Id<'catalogEntry'>,
      _creationTime: 8,
      scope: 'character',
      characterId,
    } as unknown as CatalogEntry;
  });
  const featCatalogs = feats.map((feat) => {
    const definition = representativeSelectionCatalog.find(
      (entry) => entry.ruleIdentity === feat.key,
    );
    if (!definition) throw new Error(`Missing ${feat.key}`);
    return {
      ...definition,
      _id: `${feat.id}-catalog` as Id<'catalogEntry'>,
      _creationTime: 7,
      scope: 'character',
      characterId,
    } as unknown as CatalogEntry;
  });
  const entries: Entry[] = [
    {
      _id: 'base-entry' as Id<'characterSheetEntry'>,
      _creationTime: 1,
      characterId,
      kind: 'base',
      active: true,
      catalogEntryId: baseCatalog._id,
      state: {
        kind: 'base',
        ...(favoredClassIds.length > 0 ? { favoredClassIds } : {}),
        ...(manualProficiencies ? { proficiencies: manualProficiencies } : {}),
      },
    } as Entry,
    ...levels.map(
      (level, index) =>
        ({
          _id: level.id as Id<'characterSheetEntry'>,
          _creationTime: 2 + index,
          characterId,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId: level.classId ?? null,
            ...(level.skillRanks !== undefined
              ? { skillRanks: level.skillRanks }
              : {}),
            ...(level.proficiencyChoice !== undefined
              ? { proficiencyChoice: level.proficiencyChoice }
              : {}),
            position: index + 1,
            hpGained: level.hp,
            ...(level.favoredClassBonus !== undefined
              ? { favoredClassBonus: level.favoredClassBonus }
              : {}),
            ...(level.abilityIncrease !== undefined
              ? { abilityIncrease: level.abilityIncrease }
              : {}),
          },
        }) as Entry,
    ),
    ...adjustments.map(
      (adjustment, index) =>
        ({
          _id: adjustment.id as Id<'characterSheetEntry'>,
          _creationTime: 10 + index,
          characterId,
          kind: 'manual',
          active: adjustment.active ?? true,
          catalogEntryId: `${adjustment.id}-catalog` as Id<'catalogEntry'>,
          state: { kind: 'manual' },
          ...(adjustment.gainedAtClassLevel
            ? { gainedAtClassLevel: adjustment.gainedAtClassLevel }
            : {}),
        }) as Entry,
    ),
    ...abilityChanges.map(
      (change, index) =>
        ({
          _id: change.id as Id<'characterSheetEntry'>,
          _creationTime: 20 + index,
          characterId,
          kind: change.kind,
          active: change.active ?? true,
          state: {
            kind: change.kind,
            ability: change.ability,
            points: change.points,
          },
        }) as Entry,
    ),
    ...(race
      ? [
          {
            _id: (race.id ?? 'race-entry') as Id<'characterSheetEntry'>,
            _creationTime: 40,
            characterId,
            kind: 'race',
            active: race.active ?? true,
            catalogEntryId: race.key as Id<'catalogEntry'>,
            state: {
              kind: 'race',
              ...(race.racialHpGained !== undefined
                ? { racialHpGained: race.racialHpGained }
                : {}),
              ...(race.racialSkillRanks
                ? { racialSkillRanks: race.racialSkillRanks }
                : {}),
            },
          } as Entry,
        ]
      : []),
    ...racialTraits.map(
      (trait, index) =>
        ({
          _id: trait.id as Id<'characterSheetEntry'>,
          _creationTime: 50 + index,
          characterId,
          kind: 'racialTrait',
          active: trait.active ?? true,
          catalogEntryId: trait.key as Id<'catalogEntry'>,
          ...(trait.grantKey ? { grantKey: trait.grantKey } : {}),
          ...(trait.notes !== undefined ? { notes: trait.notes } : {}),
          ...(trait.kept ? { kept: true } : {}),
          state: {
            kind: 'racialTrait',
            ...(trait.choice !== undefined ? { choice: trait.choice } : {}),
            ...(trait.secondChoice !== undefined
              ? { secondChoice: trait.secondChoice }
              : {}),
            ...(trait.replaces ? { replaces: trait.replaces } : {}),
          },
        }) as Entry,
    ),
    ...sheetEntries.map(
      (entry, index) =>
        ({
          _id: entry.id as Id<'characterSheetEntry'>,
          _creationTime: 30 + index,
          characterId,
          kind: entry.detail.kind,
          active: entry.active ?? true,
          catalogEntryId: `${entry.id}-catalog` as Id<'catalogEntry'>,
          state: entryState(entry),
        }) as Entry,
    ),
    ...attackRoutines.map(
      (routine, index) =>
        ({
          _id: routine.id as Id<'characterSheetEntry'>,
          _creationTime: 70 + index,
          characterId,
          kind: 'attackRoutine',
          active: !routine.deleted,
          state: {
            kind: 'attackRoutine',
            name: routine.name,
            weaponEntryId: routine.weaponEntryId,
            hands: routine.hands ?? 'one',
            mode: routine.mode ?? 'melee',
            ...(routine.offHand ? { offHand: routine.offHand } : {}),
            ...(routine.ammunitionEntryId
              ? { ammunitionEntryId: routine.ammunitionEntryId }
              : {}),
            ...(routine.rangeIncrements !== undefined
              ? { rangeIncrements: routine.rangeIncrements }
              : {}),
            ...(routine.naturalAttackEntryIds
              ? { naturalAttackEntryIds: routine.naturalAttackEntryIds }
              : {}),
            ...(routine.availableLimbs === undefined
              ? {}
              : { availableLimbs: routine.availableLimbs }),
            ...(routine.options ? { options: routine.options } : {}),
            revision: routine.revision ?? 0,
          },
        }) as Entry,
    ),
    ...feats.map(
      (feat, index) =>
        ({
          _id: feat.id as Id<'characterSheetEntry'>,
          _creationTime: 80 + index,
          characterId,
          kind: 'feat',
          active: feat.active ?? true,
          catalogEntryId: `${feat.id}-catalog` as Id<'catalogEntry'>,
          state: {
            kind: 'feat',
            ...(feat.choice !== undefined ? { choice: feat.choice } : {}),
          },
        }) as Entry,
    ),
  ];
  const catalogEntries = [
    baseCatalog,
    ...classCatalogs,
    ...raceCatalogs,
    ...adjustmentCatalogs,
    ...entryCatalogs,
    ...featCatalogs,
    ...abilityCatalogs,
  ];
  return {
    owner: null,
    familiarRelationshipId: null,
    companionCalculationInputs: null,
    campaign: {
      campaignId,
      campaignName: 'Ironfang',
      organizationId: 'org',
      ownershipAvailable: true,
    },
    character: {
      _id: characterId,
      _creationTime: 1,
      campaignId,
      name,
      description: 'Rides with the militia.',
      ownerId: 'owner',
      kind: 'pc',
      isActive: true,
      sheetMode: 'full',
      level: 1,
      ...defaultAbilityScores,
    },
    entries,
    catalogEntries,
    baseScoresEntry: baseCatalog,
    calculated: calculateFixtureSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
    permanentCalculated: calculateFixtureSheet(
      {
        entries,
        catalogEntries,
        characterKind: 'pc',
      },
      { permanentOnly: true },
    ),
    acceptedWarnings: accepted.map((warning, index) => ({
      _id: `accepted-${index}` as Id<'acceptedWarning'>,
      _creationTime: 10 + index,
      characterId,
      acceptedBy: 'other-player',
      acceptedAt: 10 + index,
      ...warning,
    })),
    revision: 1,
    lastOperationId,
    updatedBy: 'owner',
  };
}
