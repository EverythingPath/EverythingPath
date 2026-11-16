import type {
  ArchetypeFeatureChange,
  ArchetypeReplacement,
  CharacterSheetCatalogEntry,
  CharacterSheetClassDetail,
  CharacterSheetInput,
  SheetEntry,
  SheetWarning,
} from './character-sheet';
import {
  archetypeClassApplicability,
  archetypeSelectionBelongsToClass,
  characterSheetClassFamily,
  classFeatureMetadata,
  isCompatibleArchetypeCounterpart,
  normalizeCharacterSheetChoiceName,
} from './character-sheet-archetype-helpers';

type ArchetypeInput = Pick<CharacterSheetInput, 'entries' | 'catalogEntries'>;
type ArchetypeSelection = Extract<SheetEntry, { kind: 'archetype' }>;
type FeatureRow = { classLevel: number; catalogEntryId: string };
type ClassContext = {
  baseClass: CharacterSheetCatalogEntry;
  detail: CharacterSheetClassDetail;
  family: string;
  classLevel: number;
  catalog: ReadonlyMap<string, CharacterSheetCatalogEntry>;
  catalogEntries: CharacterSheetInput['catalogEntries'];
  schedule: readonly FeatureRow[];
  originalSchedule: readonly FeatureRow[];
  compatibleCounterpart: boolean;
};

function warning({
  check,
  entryId,
  facts,
  message,
  subject = entryId,
}: {
  check: SheetWarning['check'];
  entryId: string;
  facts: unknown;
  message: string;
  subject?: string;
}): SheetWarning {
  return {
    kind: 'rules',
    check,
    target: { kind: 'entry', entryId },
    subject,
    fingerprint: JSON.stringify(facts),
    message,
  };
}

function unique<Value>(values: Value[], key: (value: Value) => string) {
  return [...new Map(values.map((value) => [key(value), value])).values()];
}

function identity(context: ClassContext, id: string) {
  return context.catalog.get(id)?.ruleIdentity ?? id;
}

function featureMetadata(context: ClassContext, row: FeatureRow) {
  const definition = context.catalog.get(row.catalogEntryId);
  return classFeatureMetadata({
    definition: definition ?? {
      ruleIdentity: row.catalogEntryId,
    },
    classLevel: row.classLevel,
  });
}

function classContexts(input: ArchetypeInput): ClassContext[] {
  const catalog = new Map(
    input.catalogEntries.map((entry) => [entry._id, entry]),
  );
  const levels = input.entries.filter((entry) => entry.kind === 'classLevel');
  const definitions = [
    ...new Set(
      levels.flatMap((entry) =>
        entry.state.classEntryId ? [entry.state.classEntryId] : [],
      ),
    ),
  ];
  return definitions.flatMap((id) => {
    const baseClass = catalog.get(id);
    const detail = baseClass?.detail;
    if (
      !baseClass ||
      detail?.kind !== 'class' ||
      !('skillRanksPerLevel' in detail)
    )
      return [];
    const family = characterSheetClassFamily(baseClass, input.catalogEntries);
    const counterpart = detail.counterpartOf
      ? catalog.get(detail.counterpartOf)
      : undefined;
    const counterpartDetail = counterpart?.detail;

    return [
      {
        baseClass,
        detail,
        family,
        catalog,
        catalogEntries: input.catalogEntries,
        classLevel: levels.filter((entry) => {
          const definition = catalog.get(entry.state.classEntryId ?? '');
          return (
            definition &&
            characterSheetClassFamily(definition, input.catalogEntries) ===
              family
          );
        }).length,
        schedule: detail.featuresByLevel ?? [],
        originalSchedule:
          counterpartDetail?.kind === 'class' &&
          'featuresByLevel' in counterpartDetail
            ? (counterpartDetail.featuresByLevel ?? [])
            : [],
        compatibleCounterpart: isCompatibleArchetypeCounterpart({
          baseClass,
          catalogEntries: input.catalogEntries,
        }),
      },
    ];
  });
}

function canonicalFeature(context: ClassContext, row: FeatureRow) {
  const definition = context.catalog.get(row.catalogEntryId);
  if (!definition?.name || !context.compatibleCounterpart) return definition;
  const name = normalizeCharacterSheetChoiceName(definition.name);
  const original = context.originalSchedule.find((candidate) => {
    const feature = context.catalog.get(candidate.catalogEntryId);
    return (
      candidate.classLevel === row.classLevel &&
      feature?.name &&
      normalizeCharacterSheetChoiceName(feature.name) === name
    );
  });
  return original
    ? (context.catalog.get(original.catalogEntryId) ?? definition)
    : definition;
}

function canonicalMetadata(context: ClassContext, row: FeatureRow) {
  const definition = canonicalFeature(context, row);
  return definition
    ? classFeatureMetadata({ definition, classLevel: row.classLevel })
    : featureMetadata(context, row);
}

function canonicalChanges(
  context: ClassContext,
  change: ArchetypeFeatureChange,
): ArchetypeFeatureChange[] {
  if (!context.compatibleCounterpart) return [change];
  const matching = context.schedule.filter((row) => {
    const metadata = featureMetadata(context, row);
    return (
      metadata.featureIdentity === change.featureIdentity &&
      (change.scope === 'whole' || metadata.part === change.part)
    );
  });
  const canonical = matching.map((row): ArchetypeFeatureChange => {
    const metadata = canonicalMetadata(context, row);
    return change.scope === 'whole'
      ? { featureIdentity: metadata.featureIdentity, scope: 'whole' }
      : { ...metadata, scope: 'part' };
  });
  return canonical.length ? unique(canonical, JSON.stringify) : [change];
}

function replacementRows({
  context,
  replacement,
  directlyApplicable,
}: {
  context: ClassContext;
  replacement: ArchetypeReplacement;
  directlyApplicable: boolean;
}) {
  const target = context.catalog.get(replacement.catalogEntryId);
  const anchors = context.schedule.filter((row) => {
    const candidate = context.catalog.get(row.catalogEntryId);
    return (
      replacement.classLevel === row.classLevel &&
      (identity(context, row.catalogEntryId) ===
        identity(context, replacement.catalogEntryId) ||
        (!directlyApplicable &&
          context.compatibleCounterpart &&
          target?.name &&
          candidate?.name &&
          normalizeCharacterSheetChoiceName(target.name) ===
            normalizeCharacterSheetChoiceName(candidate.name)))
    );
  });
  if (replacement.scope !== 'whole') return anchors;
  const parents = new Set(
    anchors.map((row) => featureMetadata(context, row).featureIdentity),
  );
  return context.schedule.filter((row) =>
    parents.has(featureMetadata(context, row).featureIdentity),
  );
}

function resolveReplacements({
  context,
  entry,
  definition,
  directlyApplicable,
  applicable,
  warnings,
}: {
  context: ClassContext;
  entry: ArchetypeSelection;
  definition: CharacterSheetCatalogEntry;
  directlyApplicable: boolean;
  applicable: boolean;
  warnings: SheetWarning[];
}) {
  const archetype = definition.detail;
  if (archetype?.kind !== 'archetype') return [];
  const replacements = (entry.state.replaces ?? archetype.replaces).flatMap(
    (replacement) => {
      const scope = replacement.scope ?? 'part';
      const matches = replacementRows({
        context,
        replacement,
        directlyApplicable,
      });
      const facts = [
        context.family,
        replacement.classLevel,
        identity(context, replacement.catalogEntryId),
        scope,
      ];
      if (entry.active && applicable && matches.length === 0)
        warnings.push(
          warning({
            check: 'archetypeReplacementUnmatched',
            entryId: entry._id,
            facts: [definition.ruleIdentity, ...facts],
            message: `${definition.name ?? 'Archetype'}: the replaced feature has no matching row in ${context.baseClass.name ?? 'this class'}.`,
            subject: `${entry._id}:missing:${JSON.stringify(facts)}`,
          }),
        );
      return applicable ? matches.map((row) => ({ ...row, scope })) : [];
    },
  );
  return unique(replacements, (row) =>
    JSON.stringify([row.classLevel, row.catalogEntryId]),
  );
}

function resolveArchetype({
  context,
  entry,
  warnings,
}: {
  context: ClassContext;
  entry: ArchetypeSelection;
  warnings: SheetWarning[];
}) {
  const definition = context.catalog.get(entry.catalogEntryId);
  const archetype = definition?.detail;
  if (
    !definition ||
    archetype?.kind !== 'archetype' ||
    !archetypeSelectionBelongsToClass({
      selection: entry,
      baseClass: context.baseClass,
      catalogEntries: context.catalogEntries,
    })
  )
    return [];
  const { directlyApplicable, familyApplicable, applicable } =
    archetypeClassApplicability({
      archetype: definition,
      baseClass: context.baseClass,
      catalogEntries: context.catalogEntries,
    });
  if (!directlyApplicable && !familyApplicable) return [];
  if (entry.active && !applicable)
    warnings.push(
      warning({
        check: 'archetypeUnchainedMonk',
        entryId: entry._id,
        facts: [definition.ruleIdentity, context.baseClass.ruleIdentity],
        message: `${definition.name ?? 'Archetype'} was written for the original class and cannot automatically replace this class's features.`,
      }),
    );
  const replacements = resolveReplacements({
    context,
    entry,
    definition,
    directlyApplicable,
    applicable,
    warnings,
  });
  const changes: ArchetypeFeatureChange[] = [
    ...(archetype.featureChanges ?? []).flatMap((change) =>
      canonicalChanges(context, change),
    ),
    ...(entry.state.replaces ?? archetype.replaces).map(
      (replacement): ArchetypeFeatureChange => {
        const metadata = canonicalMetadata(context, replacement);
        return replacement.scope === 'whole'
          ? { featureIdentity: metadata.featureIdentity, scope: 'whole' }
          : { ...metadata, scope: 'part' };
      },
    ),
  ];
  return [
    {
      entryId: entry._id,
      catalogEntryId: definition._id,
      ruleIdentity: definition.ruleIdentity,
      name: definition.name ?? 'Archetype',
      active: entry.active,
      applicable,
      replacements,
      additions: applicable ? archetype.adds.map((row) => ({ ...row })) : [],
      changes: unique(changes, JSON.stringify),
      classSkillsAdded: applicable
        ? [...(archetype.classSkillsAdded ?? [])]
        : [],
      classSkillsRemoved: applicable
        ? [...(archetype.classSkillsRemoved ?? [])]
        : [],
      skillRanksPerLevel: applicable ? archetype.skillRanksPerLevel : undefined,
      casting: applicable ? archetype.casting : undefined,
      castingChoices: [...(entry.state.castingChoices ?? [])],
    },
  ];
}

type ArchetypeApplication = ReturnType<typeof resolveArchetype>[number];

function detectConflicts({
  active,
  family,
  warnings,
}: {
  active: ArchetypeApplication[];
  family: string;
  warnings: SheetWarning[];
}) {
  return active.flatMap((first, index) =>
    active.slice(index + 1).flatMap((second) => {
      const overlaps = first.changes.flatMap((left) =>
        second.changes.flatMap((right) => {
          if (
            left.featureIdentity !== right.featureIdentity ||
            (left.scope !== 'whole' &&
              right.scope !== 'whole' &&
              left.part !== right.part)
          )
            return [];
          return [
            {
              featureIdentity: left.featureIdentity,
              part:
                left.scope === 'whole' || right.scope === 'whole'
                  ? null
                  : left.part,
            },
          ];
        }),
      );
      return unique(overlaps, JSON.stringify).map(
        ({ featureIdentity, part }) => {
          const entryIds = [first.entryId, second.entryId].sort();
          const facts = [
            family,
            [first.ruleIdentity, second.ruleIdentity].sort(),
            featureIdentity,
            part,
          ];
          const entryId = entryIds[0] ?? first.entryId;
          warnings.push(
            warning({
              check: 'archetypeConflict',
              entryId,
              facts,
              message: `${first.name} and ${second.name} both alter the same class feature. Both remain selected.`,
              subject: `${entryId}:conflict:${JSON.stringify(facts)}`,
            }),
          );
          return { featureIdentity, part, entryIds, classIdentity: family };
        },
      );
    }),
  );
}

function archetypeClassSkillEffects({
  detail,
  archetypes,
}: {
  detail: CharacterSheetClassDetail;
  archetypes: readonly ArchetypeApplication[];
}) {
  const active = archetypes.filter(
    (archetype) => archetype.active && archetype.applicable,
  );
  const ranks = [
    ...new Set(
      active.flatMap((archetype) =>
        archetype.skillRanksPerLevel === undefined
          ? []
          : [archetype.skillRanksPerLevel],
      ),
    ),
  ];
  const removed = new Set(
    active.flatMap((archetype) => archetype.classSkillsRemoved),
  );
  return {
    classSkills: [
      ...new Set([
        ...(detail.classSkills ?? []).filter((skill) => !removed.has(skill)),
        ...active.flatMap((archetype) => archetype.classSkillsAdded),
      ]),
    ],
    skillRanksPerLevel:
      ranks.length > 1 ? null : (ranks[0] ?? detail.skillRanksPerLevel),
  };
}

function resolveClass(
  context: ClassContext,
  selections: ArchetypeSelection[],
  warnings: SheetWarning[],
) {
  const archetypes = selections.flatMap((entry) =>
    resolveArchetype({ context, entry, warnings }),
  );
  const active = archetypes
    .filter((archetype) => archetype.active && archetype.applicable)
    .sort((left, right) => left.entryId.localeCompare(right.entryId));
  const conflicts = detectConflicts({
    active,
    family: context.family,
    warnings,
  });
  const skills = archetypeClassSkillEffects({
    detail: context.detail,
    archetypes,
  });
  if (skills.skillRanksPerLevel === null)
    warnings.push(
      warning({
        check: 'archetypeSkillRanksConflict',
        entryId: active[0]?.entryId ?? context.baseClass._id,
        facts: [
          context.family,
          [
            ...new Set(
              active.flatMap((archetype) =>
                archetype.skillRanksPerLevel === undefined
                  ? []
                  : [archetype.skillRanksPerLevel],
              ),
            ),
          ].sort((a, b) => a - b),
        ],
        message:
          'Selected archetypes specify different skill rank budgets; the affected budget is unresolved.',
      }),
    );
  return {
    classEntryId: context.baseClass._id,
    classIdentity: context.family,
    classLevel: context.classLevel,
    ...skills,
    archetypes,
    conflicts,
  };
}

export function resolveCharacterSheetArchetypes(input: ArchetypeInput) {
  const selections = input.entries.filter(
    (entry): entry is ArchetypeSelection =>
      entry.kind === 'archetype' && !entry.grantKey,
  );
  const warnings: SheetWarning[] = [];
  const classes = classContexts(input).map((context) =>
    resolveClass(context, selections, warnings),
  );
  for (const entry of selections) {
    if (
      !entry.active ||
      classes.some((result) =>
        result.archetypes.some((archetype) => archetype.entryId === entry._id),
      )
    )
      continue;
    const definition = input.catalogEntries.find(
      (candidate) => candidate._id === entry.catalogEntryId,
    );
    if (definition?.detail?.kind !== 'archetype') continue;
    const identity = (id: string) =>
      input.catalogEntries.find((candidate) => candidate._id === id)
        ?.ruleIdentity ?? id;
    warnings.push(
      warning({
        check: 'archetypeClass',
        entryId: entry._id,
        facts: [
          definition.ruleIdentity,
          definition.detail.classEntryIds.map(identity).sort(),
          entry.state.classEntryId ? identity(entry.state.classEntryId) : null,
        ],
        message: `${definition.name ?? 'Archetype'} has no applicable Class Levels in its selected class; its features do not count.`,
      }),
    );
  }
  return {
    classes,
    conflicts: unique(
      classes.flatMap((result) => result.conflicts),
      JSON.stringify,
    ),
    warnings: unique(warnings, (item) =>
      JSON.stringify([item.check, item.subject, item.fingerprint]),
    ),
  };
}

export type ResolvedCharacterSheetArchetypes = ReturnType<
  typeof resolveCharacterSheetArchetypes
>;
