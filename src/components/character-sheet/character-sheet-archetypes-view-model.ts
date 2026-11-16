import type { Id } from '@convex/_generated/dataModel';
import type { ComponentProps } from 'react';
import type { GrantEntryList } from './character-sheet-grants';
import type { GrantEntryView } from './character-sheet-grants-view-model';
import { skillDefinitions } from '~/lib/character-sheet-skills';
import { classFeatureMetadata } from '~/lib/character-sheet-archetype-helpers';
import type { useCharacterSheetArchetypes } from './use-character-sheet-archetypes';

export type ArchetypesController = ReturnType<
  typeof useCharacterSheetArchetypes
>;
export type ArchetypeClassView = ArchetypesController['classes'][number];
export type ArchetypeOptionView = ArchetypeClassView['options'][number];
export type ArchetypeSelection = NonNullable<ArchetypeOptionView['selection']>;
export type ArchetypeApplication = NonNullable<
  ArchetypeOptionView['application']
>;
export type ClassFeatureOption = ArchetypeClassView['featureOptions'][number];
/** Class feature names by catalog definition, for rows outside the schedule. */
export type FeatureNames = Readonly<Record<string, string>>;

/** The Grants UI for the Selections' own rows and the originals they replace. */
export type ArchetypeGrantProps = {
  grantRows: ReadonlyMap<string, GrantEntryView>;
  rowProps: Omit<ComponentProps<typeof GrantEntryList>, 'rows' | 'className'>;
};

export type ReplacementScope = 'whole' | 'part';
export type ReplacementChoice = {
  classLevel: number;
  catalogEntryId: Id<'catalogEntry'>;
  scope?: ReplacementScope;
};

/** The option whose definition carries the class's recorded Selection. */
export function isAppliedOption(
  option: ArchetypeOptionView,
): option is ArchetypeOptionView & { selection: ArchetypeSelection } {
  return option.selection?.catalogEntryId === option.definition._id;
}

/** Selections shown by a class's cards; the rest are not counting now. */
export function listRepresentedSelectionIds(
  classes: ArchetypeClassView[],
): ReadonlySet<string> {
  return new Set(
    classes.flatMap((group) =>
      group.options.flatMap((option) =>
        isAppliedOption(option) ? [option.selection._id] : [],
      ),
    ),
  );
}

export function describeSources(option: ArchetypeOptionView) {
  return option.definition.sources
    .map((source) =>
      source.pages ? `${source.book} p. ${source.pages}` : source.book,
    )
    .join('; ');
}

/** The replacements in force: the player's own rows, else the catalog's. */
export function listEffectiveReplacements(
  option: ArchetypeOptionView,
): ReplacementChoice[] {
  const detail = option.definition.detail;
  const catalogRows = detail.kind === 'archetype' ? detail.replaces : [];
  return [...(option.selection?.state.replaces ?? catalogRows)];
}

export function hasOwnReplacements(option: ArchetypeOptionView) {
  return option.selection?.state.replaces !== undefined;
}

export function findFeatureOption(
  featureOptions: ClassFeatureOption[],
  catalogEntryId: string,
) {
  return featureOptions.find((row) => row.definition._id === catalogEntryId);
}

export function findFeatureName({
  featureOptions,
  featureNames,
  catalogEntryId,
}: {
  featureOptions: ClassFeatureOption[];
  featureNames: FeatureNames;
  catalogEntryId: string;
}) {
  return (
    findFeatureOption(featureOptions, catalogEntryId)?.definition.name ??
    featureNames[catalogEntryId] ??
    'Unavailable feature'
  );
}

/** A feature made of independently replaceable parts, such as Bravery. */
export function isFeaturePart(option: ClassFeatureOption | undefined) {
  return (
    option?.definition.detail.kind === 'classFeature' &&
    option.definition.detail.parentFeature !== undefined
  );
}

// A whole multi-part feature reads as its shared name: "Bravery", not
// "Bravery +1".
function describeWholeFeature(parts: ClassFeatureOption[]) {
  const name = parts[0]?.definition.name ?? 'A class feature';
  if (parts.length < 2) return name;
  return name.replace(/\s*\+?\d+(d\d+)?$/, '') || name;
}

/** A readable name for a feature, or for one of its parts. */
export function describeFeature({
  featureOptions,
  featureIdentity,
  part,
}: {
  featureOptions: ClassFeatureOption[];
  featureIdentity: string;
  part: string | null;
}) {
  const parts = featureOptions.filter(
    (row) => classFeatureMetadata(row).featureIdentity === featureIdentity,
  );
  if (part === null) return describeWholeFeature(parts);
  return (
    parts.find((row) => classFeatureMetadata(row).part === part)?.definition
      .name ?? describeWholeFeature(parts)
  );
}

export type FeatureRelation = {
  key: string;
  kind: 'conflict' | 'compatible';
  otherName: string;
  featureName: string;
  isWholeFeature: boolean;
};

export function describeRelation(relation: FeatureRelation) {
  if (relation.kind === 'compatible')
    return `Independent part, compatible with ${relation.otherName}: ${relation.featureName}`;
  return relation.isWholeFeature
    ? `Whole feature also altered by ${relation.otherName}: ${relation.featureName}`
    : `Same part as ${relation.otherName}: ${relation.featureName}`;
}

function listOtherApplications(group: ArchetypeClassView, entryId: string) {
  return group.options.flatMap((option) =>
    isAppliedOption(option) &&
    option.selection._id !== entryId &&
    option.application?.active &&
    option.application.applicable
      ? [{ name: option.definition.name, application: option.application }]
      : [],
  );
}

/**
 * How this Archetype's altered features meet the class's other active
 * Archetypes: a conflict on the same part or whole feature, or independent
 * parts of one feature that coexist.
 */
export function listFeatureRelations(
  group: ArchetypeClassView,
  option: ArchetypeOptionView,
): FeatureRelation[] {
  const entryId = option.selection?._id;
  const application = option.application;
  if (!entryId || !application?.active || !application.applicable) return [];
  const others = listOtherApplications(group, entryId);
  const nameOf = (id: string) =>
    others.find((other) => other.application.entryId === id)?.name ??
    'another Archetype';
  const conflicts = (group.calculated?.conflicts ?? []).filter((conflict) =>
    conflict.entryIds.includes(entryId),
  );
  const relations = new Map<string, FeatureRelation>();
  for (const conflict of conflicts) {
    const otherId = conflict.entryIds.find((id) => id !== entryId) ?? '';
    const key = `conflict:${otherId}:${conflict.featureIdentity}:${conflict.part}`;
    relations.set(key, {
      key,
      kind: 'conflict',
      otherName: nameOf(otherId),
      featureName: describeFeature({
        featureOptions: group.featureOptions,
        featureIdentity: conflict.featureIdentity,
        part: conflict.part,
      }),
      isWholeFeature: conflict.part === null,
    });
  }
  for (const other of others) {
    const sharesConflict = (featureIdentity: string) =>
      conflicts.some(
        (conflict) =>
          conflict.featureIdentity === featureIdentity &&
          conflict.entryIds.includes(other.application.entryId),
      );
    for (const change of application.changes) {
      const isShared = other.application.changes.some(
        (candidate) => candidate.featureIdentity === change.featureIdentity,
      );
      if (!isShared || sharesConflict(change.featureIdentity)) continue;
      const key = `compatible:${other.application.entryId}:${change.featureIdentity}`;
      relations.set(key, {
        key,
        kind: 'compatible',
        otherName: other.name,
        featureName: describeFeature({
          featureOptions: group.featureOptions,
          featureIdentity: change.featureIdentity,
          part: null,
        }),
        isWholeFeature: false,
      });
    }
  }
  return [...relations.values()];
}

function listSkillNames(keys: readonly string[]) {
  return keys.flatMap((key) => {
    const skill = skillDefinitions.find(
      (definition) =>
        definition.key === key || definition.key === `skill.${key}`,
    );
    return skill ? [skill.name] : [];
  });
}

/** Class skills and the skill rank budget an Archetype changes, in words. */
export function describeSkillChanges(application: ArchetypeApplication) {
  const added = listSkillNames(application.classSkillsAdded);
  const removed = listSkillNames(application.classSkillsRemoved);
  return [
    added.length ? `Class skills added: ${added.join(', ')}` : null,
    removed.length ? `Class skills removed: ${removed.join(', ')}` : null,
    application.skillRanksPerLevel === undefined
      ? null
      : `Skill ranks per level: ${application.skillRanksPerLevel}`,
  ].filter((line) => line !== null);
}
