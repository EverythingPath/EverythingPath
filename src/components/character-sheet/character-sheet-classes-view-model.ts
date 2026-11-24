import { describeRetiredChoice } from './retired-catalog-choices';
import type { Id } from '@convex/_generated/dataModel';
import {
  calculateCharacterSheet,
  type SheetEntry,
} from '~/lib/character-sheet';
import { characterSheetClassFamily } from '~/lib/character-sheet-grants';
import {
  activeRaceIdentities,
  favoredClassReward,
  favoredClassRewardChoiceName,
  favoredClassRewardsFitting,
  favoredClassRewardTargetsOnSheet,
  isTargetedReward,
  levelClassIdentities,
  rewardRaceIdentities,
  targetReason,
  type FavoredClassTargetReason,
} from '~/lib/character-sheet-favored-class-rewards';
import {
  applyClassSwitch,
  describeClassSwitch,
  planClassSwitch,
} from '~/lib/character-sheet-class-switch';
import { warningsForAcceptanceThroughDormancy } from '~/lib/character-sheet-dormant-acceptance';
import { prerequisiteLabel } from '~/lib/character-sheet-prerequisites';
import { versionLabel, versionOrigin } from './class-switch-copy';
import { buildEntryPrerequisiteView } from './character-sheet-selections-view-model';
import type {
  CharacterSheetSnapshot,
  SheetWarningView,
} from './use-character-sheet';

type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
/** A favored-class reward a level may take, with a targeted one's power. */
export type FavoredClassRewardChoice = {
  reward: string;
  target?: string;
  name: string;
};
/**
 * Where a level's saved reward stands (reward-target fix r1): offered as a
 * choice, no longer listed, no longer fitting the level, or fitting while the
 * sheet no longer has its power. `name` is the choice's name.
 */
export type SavedFavoredClassReward =
  | { kind: 'offered' }
  | { kind: 'unlisted' }
  | { kind: 'notFitting'; name: string }
  /** Fix r2: fits, but its target does not count, for the calculator's reason. */
  | { kind: 'target'; reason: FavoredClassTargetReason; name: string };
type ClassDefinition = Extract<
  CatalogEntry,
  { detail: { kind: 'class'; hitDie: number } }
>;
type ClassLevel = Extract<SheetEntry, { kind: 'classLevel' }>;
type StoredEntry = CharacterSheetSnapshot['entries'][number];
type StoredClassLevel = Extract<StoredEntry, { kind: 'classLevel' }>;
type ClassesSnapshot = Omit<CharacterSheetSnapshot, 'entries'> & {
  entries: (
    | Exclude<StoredEntry, { kind: 'classLevel' }>
    | (Omit<StoredClassLevel, 'active'> & { active: boolean })
  )[];
};

export const emptyClassCatalogChoices: readonly CatalogEntry[] = [];

function classCatalog(
  snapshot: ClassesSnapshot,
  catalogChoices: readonly CatalogEntry[],
) {
  return [
    ...new Map(
      [...catalogChoices, ...snapshot.catalogEntries].map((entry) => [
        entry._id,
        entry,
      ]),
    ).values(),
  ];
}

function previewClassLevels(
  snapshot: ClassesSnapshot,
  catalogEntries: CatalogEntry[],
  definition: ClassDefinition,
  entryId?: Id<'characterSheetEntry'>,
) {
  const replaced = entryId
    ? snapshot.entries.find((entry) => entry._id === entryId)
    : undefined;
  if (entryId && replaced?.kind !== 'classLevel') return null;
  const sourceEntries = snapshot.entries.flatMap((entry): SheetEntry[] => {
    if (entry.kind !== 'classLevel') return [entry];
    if (entry._id === replaced?._id) {
      return [
        {
          ...entry,
          active: true,
          state: { ...entry.state, classEntryId: definition._id },
        },
      ];
    }
    return entry.active ? [{ ...entry, active: true }] : [];
  });
  const existing = sourceEntries
    .filter(
      (entry): entry is ClassLevel =>
        entry.kind === 'classLevel' && entry.active,
    )
    .sort((a, b) => a.state.position - b.state.position)
    .find(
      (entry) =>
        catalogEntries.find(
          (candidate) => candidate._id === entry.state.classEntryId,
        )?.ruleIdentity === definition.ruleIdentity,
    );
  if (existing)
    return { entries: sourceEntries, first: existing, hasExisting: true };
  const position =
    Math.max(
      0,
      ...snapshot.entries.flatMap((entry) =>
        entry.kind === 'classLevel' && entry.active
          ? [entry.state.position]
          : [],
      ),
    ) + 1;
  const first: ClassLevel = {
    _id: 'preview-class-level',
    kind: 'classLevel',
    active: true,
    state: {
      kind: 'classLevel',
      classEntryId: definition._id,
      position,
      hpGained: null,
    },
  };
  return { entries: [...sourceEntries, first], first, hasExisting: false };
}

function entryStatusLabel(
  status: ReturnType<typeof buildEntryPrerequisiteView>['recordedStatus'],
) {
  if (status === 'met') return 'Entry requirements met';
  if (status === 'unmet') return 'Entry requirements not met';
  return null;
}

function entryRequirements(
  snapshot: ClassesSnapshot,
  catalogEntries: CatalogEntry[],
  definition: ClassDefinition,
  entryId?: Id<'characterSheetEntry'>,
) {
  if (definition.detail.classKind !== 'prestige') return null;
  const preview = previewClassLevels(
    snapshot,
    catalogEntries,
    definition,
    entryId,
  );
  if (!preview) return null;
  const { entries, first, hasExisting } = preview;
  const calculated = calculateCharacterSheet({
    entries,
    catalogEntries,
    characterKind: snapshot.character.kind,
  });
  const prerequisites = buildEntryPrerequisiteView({
    snapshot: {
      acceptedWarnings: snapshot.acceptedWarnings,
      catalogEntries,
      calculated,
    },
    entryId: first._id,
    recordedLevelPosition: first.state.position,
  });
  return {
    status: prerequisites.recordedStatus,
    currentStatus: hasExisting && !entryId ? prerequisites.currentStatus : null,
    label: entryStatusLabel(prerequisites.recordedStatus),
    prerequisiteText:
      definition.prerequisiteText ??
      (definition.prerequisites ?? [])
        .map((clause) => prerequisiteLabel(clause, catalogEntries))
        .join('; '),
    checks: prerequisites.recordedChecks,
    warnings: prerequisites.recordedWarnings,
    recordedLevelLabel: prerequisites.recordedLevelLabel,
  };
}

/** The sheet as the pure calculation reads it: active Class Levels only. */
function calculationEntries(entries: ClassesSnapshot['entries']) {
  return entries.flatMap((entry): SheetEntry[] => {
    if (entry.kind !== 'classLevel') return [entry];
    return entry.active ? [{ ...entry, active: true }] : [];
  });
}

/**
 * #583: what switching the class of `entryId` to `classEntryId` would do, or
 * did: the same pure switch the server applies, calculated before and after.
 * `before` is the sheet before the switch; `after` defaults to the planned
 * result, or is the saved sheet once the switch has been saved.
 */
export function describeClassDefinitionSwitch({
  before,
  after,
  catalogChoices = emptyClassCatalogChoices,
  entryId,
  classEntryId,
}: {
  before: ClassesSnapshot;
  after?: ClassesSnapshot;
  catalogChoices?: readonly CatalogEntry[];
  entryId: Id<'characterSheetEntry'>;
  classEntryId: Id<'catalogEntry'>;
}) {
  const catalogEntries = classCatalog(after ?? before, [
    ...catalogChoices,
    ...before.catalogEntries,
  ]);
  const entries = calculationEntries(before.entries);
  const plan = planClassSwitch({
    entries,
    catalogEntries,
    entryId,
    classEntryId,
  });
  if (plan.kind !== 'switch') return null;
  const calculate = (rows: readonly SheetEntry[]) =>
    calculateCharacterSheet({
      entries: rows,
      catalogEntries,
      characterKind: before.character.kind,
    });
  const afterEntries = after
    ? calculationEntries(after.entries)
    : applyClassSwitch(entries, plan);
  const afterCalculation = calculate(afterEntries);
  return describeClassSwitch({
    before: calculate(entries),
    after: {
      ...afterCalculation,
      // As the server prunes: dormancy alone keeps an acceptance (owner).
      warningsForAcceptance: warningsForAcceptanceThroughDormancy({
        entries: afterEntries,
        calculated: afterCalculation,
        calculate: (revived) => calculate(revived).warningsForAcceptance,
      }),
    },
    acceptedWarnings: before.acceptedWarnings,
    catalogEntries,
    levelIds: plan.levelIds,
  });
}

const scopeOrder = ['global', 'campaign', 'character'] as const;

/**
 * #583: the row picker offers one card per class, never a class's other
 * Catalog Copies: the copy its levels use, else the campaign's preferred
 * copy, else the global one. A level keeps its own class's definition
 * whatever it picks; only the "Rules used" switch changes it.
 */
function pickerDefinitions(
  definitions: readonly ClassDefinition[],
  inUse: ReadonlySet<string>,
) {
  const groups = new Map<string, ClassDefinition[]>();
  for (const definition of definitions)
    groups.set(definition.ruleIdentity, [
      ...(groups.get(definition.ruleIdentity) ?? []),
      definition,
    ]);
  const offered = new Set(
    [...groups.values()].flatMap((copies) => {
      const used = copies.filter((definition) => inUse.has(definition._id));
      if (used.length > 0) return used.map((definition) => definition._id);
      const [first] = [...copies].sort(
        (left, right) =>
          Number(Boolean(right.campaignPreference)) -
            Number(Boolean(left.campaignPreference)) ||
          scopeOrder.indexOf(left.scope) - scopeOrder.indexOf(right.scope),
      );
      return first ? [first._id] : [];
    }),
  );
  return definitions.filter((definition) => offered.has(definition._id));
}

/** Class choices remain selectable regardless of advisory entry requirements. */
export function buildCharacterSheetClassesView(
  snapshot: ClassesSnapshot,
  catalogChoices: readonly CatalogEntry[] = emptyClassCatalogChoices,
) {
  const catalogEntries = classCatalog(snapshot, catalogChoices);
  const definitions = catalogEntries.filter(
    (entry): entry is ClassDefinition =>
      entry.detail.kind === 'class' && 'hitDie' in entry.detail,
  );
  const levels = snapshot.entries
    .flatMap((entry) =>
      entry.kind === 'classLevel' && entry.active ? [entry] : [],
    )
    .sort((left, right) => left.state.position - right.state.position);
  const inUse = new Set(
    levels.flatMap((entry) => entry.state.classEntryId ?? []),
  );
  const familyOf = (classEntryId: string | null) => {
    const definition = definitions.find((entry) => entry._id === classEntryId);
    return definition
      ? characterSheetClassFamily(definition, catalogEntries)
      : null;
  };
  /**
   * rotation-7: the listed favored-class rewards that fit a level, those of
   * its class for a race the character counts as (fix r1: the calculated
   * `racial.countsAsRaces`, as the count reads it).
   */
  function fittingRewards(entryId: Id<'characterSheetEntry'>) {
    const row = levels.find((entry) => entry._id === entryId);
    const definition = definitions.find(
      (entry) => entry._id === row?.state.classEntryId,
    );
    if (!definition) return [];
    return favoredClassRewardsFitting({
      classIdentities: levelClassIdentities(definition, catalogEntries),
      raceIdentities: rewardRaceIdentities(
        activeRaceIdentities({ entries: snapshot.entries, catalogEntries }),
        snapshot.calculated.racial.countsAsRaces,
      ),
    });
  }
  const switchPreviews = new Map<
    string,
    ReturnType<typeof describeClassDefinitionSwitch>
  >();
  const previews = new Map<string, ReturnType<typeof entryRequirements>>();
  function preview(
    classEntryId: Id<'catalogEntry'>,
    entryId?: Id<'characterSheetEntry'>,
  ) {
    const key = JSON.stringify([classEntryId, entryId ?? null]);
    if (previews.has(key)) return previews.get(key) ?? null;
    const definition = definitions.find((entry) => entry._id === classEntryId);
    const requirements = definition
      ? entryRequirements(snapshot, catalogEntries, definition, entryId)
      : null;
    previews.set(key, requirements);
    return requirements;
  }
  return {
    isVersionChange(previousClassId: string, nextClassId: string) {
      const previous = definitions.find(
        (entry) => entry._id === previousClassId,
      );
      const next = definitions.find((entry) => entry._id === nextClassId);
      return Boolean(
        previous &&
        next &&
        previous._id !== next._id &&
        characterSheetClassFamily(previous, catalogEntries) ===
          characterSheetClassFamily(next, catalogEntries),
      );
    },
    preview,
    warnings: snapshot.calculated.warnings
      .filter(
        (warning) =>
          warning.check === 'classVersions' ||
          warning.check === 'archetypeReplacementUnmatched' ||
          warning.check === 'archetypeUnchainedMonk',
      )
      .map(
        (warning): SheetWarningView => ({
          ...warning,
          accepted:
            warning.kind === 'rules' &&
            snapshot.acceptedWarnings.some(
              (accepted) =>
                accepted.check === warning.check &&
                accepted.subject === warning.subject &&
                accepted.fingerprint === warning.fingerprint,
            ),
        }),
      ),
    choices: pickerDefinitions(definitions, inUse).map((definition) => ({
      classEntryId: definition._id,
      name: definition.name,
      unavailableReason: describeRetiredChoice(snapshot, definition),
      classKind: definition.detail.classKind,
      hitDie: definition.detail.hitDie,
      isUnchained: Boolean(definition.detail.counterpartOf),
      definition,
      get entryRequirements() {
        return preview(definition._id);
      },
    })),
    /**
     * #583: what switching this level's class to `classEntryId` would do,
     * calculated once per sheet read.
     */
    previewDefinitionSwitch(
      entryId: Id<'characterSheetEntry'>,
      classEntryId: Id<'catalogEntry'>,
    ) {
      const key = JSON.stringify([entryId, classEntryId]);
      if (!switchPreviews.has(key))
        switchPreviews.set(
          key,
          describeClassDefinitionSwitch({
            before: snapshot,
            catalogChoices,
            entryId,
            classEntryId,
          }),
        );
      return switchPreviews.get(key) ?? null;
    },
    /**
     * rotation-7: the listed favored-class rewards this level may take
     * (`fittingRewards`), by name. reward-target: a fitting targeted reward
     * once per reviewed target whose key is among the sheet's
     * `favoredClassRewardTargets` (fix r3: the keys of the maxima the
     * sheet's daily-maxima resolution yields, whatever their reward), named
     * with the power. The reported keys alone are what the sheet has, not
     * choices: they are offered only through this filter.
     */
    favoredClassRewardsFor(entryId: Id<'characterSheetEntry'>) {
      const keys = new Set(snapshot.calculated.favoredClassRewardTargets);
      return fittingRewards(entryId).flatMap(
        (reward): FavoredClassRewardChoice[] =>
          isTargetedReward(reward)
            ? favoredClassRewardTargetsOnSheet(reward, keys).map(({ key }) => ({
                reward: reward.id,
                target: key,
                name: favoredClassRewardChoiceName(reward, key),
              }))
            : [{ reward: reward.id, name: reward.name }],
      );
    },
    /**
     * reward-target fix r1, r2: where the level's saved reward stands, from
     * facts of its own: whether the reward still fits the level (as
     * `favoredClassRewardsFor` decides), then, for a targeted reward, the
     * calculator's `targetReason` over the sheet's per-day maximum keys (no
     * power saved, one the reward no longer lists, a listed one the sheet
     * lacks). Not fitting comes first.
     */
    savedFavoredClassRewardFor(
      entryId: Id<'characterSheetEntry'>,
    ): SavedFavoredClassReward | null {
      const bonus = levels.find((entry) => entry._id === entryId)?.state
        .favoredClassBonus;
      if (bonus?.choice !== 'reward') return null;
      const reward = favoredClassReward(bonus.reward);
      if (!reward) return { kind: 'unlisted' };
      const name = favoredClassRewardChoiceName(reward, bonus.target);
      if (!fittingRewards(entryId).some(({ id }) => id === reward.id))
        return { kind: 'notFitting', name };
      if (!isTargetedReward(reward)) return { kind: 'offered' };
      const reason = targetReason(
        reward,
        bonus.target,
        new Set(snapshot.calculated.favoredClassRewardTargets),
      );
      return reason ? { kind: 'target', reason, name } : { kind: 'offered' };
    },
    /**
     * #583 "Rules used": every Catalog Copy of each version of this level's
     * class, original then Unchained, when there is more than one. The one
     * in use is marked; global, campaign and own copies follow in turn.
     */
    rulesChoicesFor(entryId: Id<'characterSheetEntry'>) {
      const row = levels.find((entry) => entry._id === entryId);
      const family = familyOf(row?.state.classEntryId ?? null);
      if (!row || !family) return [];
      const choices = definitions
        .filter(
          (definition) =>
            characterSheetClassFamily(definition, catalogEntries) === family,
        )
        .map((definition) => {
          const version: 'original' | 'unchained' = definition.detail
            .counterpartOf
            ? 'unchained'
            : 'original';
          const choice = {
            name: definition.name,
            scope: definition.scope,
            isCampaignPreference: Boolean(definition.campaignPreference),
          };
          return {
            classEntryId: definition._id,
            ...choice,
            label: versionLabel(choice),
            origin: versionOrigin(choice) ?? 'global catalog',
            version,
            isCopy: Boolean(definition.copiedFrom),
            inUse: definition._id === row.state.classEntryId,
          };
        })
        .sort(
          (left, right) =>
            Number(left.version === 'unchained') -
              Number(right.version === 'unchained') ||
            scopeOrder.indexOf(left.scope) - scopeOrder.indexOf(right.scope),
        );
      return choices.length > 1 ? choices : [];
    },
    /**
     * #583: the first level, by position, of this level's class family:
     * the one level that shows the class's "Rules used" control.
     */
    firstLevelOfClass(entryId: Id<'characterSheetEntry'>) {
      const family = familyOf(
        levels.find((entry) => entry._id === entryId)?.state.classEntryId ??
          null,
      );
      if (!family) return null;
      return (
        levels.find((entry) => familyOf(entry.state.classEntryId) === family)
          ?._id ?? null
      );
    },
  };
}
