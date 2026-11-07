import type { CharacterSheetCatalogEntry, SheetEntry } from './character-sheet';

// Original class identities from pinned pf1/classes files and the prepared specimens.
// The original Monk is deliberately excluded by Pathfinder Unchained chapter 1.
const compatibleOriginalClassIdentities = new Set([
  'pf1/g3pq7xWWdUVYw6ai',
  'pf1/24b0LaabeAlUx5gN',
  'pf1/BrnHPJ2EVSQSyNQ8',
  'barbarian',
  'rogue',
  'summoner',
]);

function unchainedCounterpartOf(definition: CharacterSheetCatalogEntry) {
  return definition.detail?.kind === 'class' &&
    'counterpartOf' in definition.detail
    ? definition.detail.counterpartOf
    : undefined;
}

/** A Pathfinder Unchained class: one that names its original counterpart. */
export function isUnchainedClass(definition: CharacterSheetCatalogEntry) {
  return Boolean(unchainedCounterpartOf(definition));
}

export function characterSheetClassFamily(
  definition: CharacterSheetCatalogEntry,
  catalogEntries: readonly CharacterSheetCatalogEntry[],
) {
  const counterpart = unchainedCounterpartOf(definition);
  return counterpart
    ? (catalogEntries.find((entry) => entry._id === counterpart)
        ?.ruleIdentity ?? counterpart)
    : definition.ruleIdentity;
}

export function normalizeCharacterSheetChoiceName(name: string) {
  return name
    .replace(/\s*\(UC\)\s*/gi, '')
    .trim()
    .toLowerCase();
}

export function isCompatibleArchetypeCounterpart({
  baseClass,
  catalogEntries,
}: {
  baseClass: CharacterSheetCatalogEntry;
  catalogEntries: readonly CharacterSheetCatalogEntry[];
}) {
  const family = characterSheetClassFamily(baseClass, catalogEntries);
  return (
    family !== baseClass.ruleIdentity &&
    compatibleOriginalClassIdentities.has(family)
  );
}

export function archetypeClassApplicability({
  archetype,
  baseClass,
  catalogEntries,
}: {
  archetype: CharacterSheetCatalogEntry;
  baseClass: CharacterSheetCatalogEntry;
  catalogEntries: readonly CharacterSheetCatalogEntry[];
}) {
  const classIds =
    archetype.detail?.kind === 'archetype'
      ? archetype.detail.classEntryIds
      : [];
  const identity = (id: string) =>
    catalogEntries.find((entry) => entry._id === id)?.ruleIdentity ?? id;
  const family = characterSheetClassFamily(baseClass, catalogEntries);
  const directlyApplicable = classIds.some(
    (id) => identity(id) === baseClass.ruleIdentity,
  );
  const familyApplicable = classIds.some((id) => identity(id) === family);
  const compatibleCounterpart = isCompatibleArchetypeCounterpart({
    baseClass,
    catalogEntries,
  });
  return {
    directlyApplicable,
    familyApplicable,
    compatibleCounterpart,
    applicable:
      directlyApplicable || (familyApplicable && compatibleCounterpart),
  };
}

export function findArchetypeSelection<Entry extends SheetEntry>({
  entries,
  catalogEntries,
  ruleIdentity,
}: {
  entries: readonly Entry[];
  catalogEntries: readonly CharacterSheetCatalogEntry[];
  ruleIdentity: string;
}) {
  return entries.find(
    (entry): entry is Extract<Entry, { kind: 'archetype' }> =>
      entry.kind === 'archetype' &&
      !entry.grantKey &&
      catalogEntries.some(
        (definition) =>
          definition._id === entry.catalogEntryId &&
          definition.ruleIdentity === ruleIdentity,
      ),
  );
}

export function archetypeSelectionBelongsToClass({
  selection,
  baseClass,
  catalogEntries,
}: {
  selection: Extract<SheetEntry, { kind: 'archetype' }>;
  baseClass: CharacterSheetCatalogEntry;
  catalogEntries: readonly CharacterSheetCatalogEntry[];
}) {
  if (!selection.state.classEntryId) return true;
  const boundClass = catalogEntries.find(
    (entry) => entry._id === selection.state.classEntryId,
  );
  return (
    boundClass?.detail?.kind === 'class' &&
    characterSheetClassFamily(boundClass, catalogEntries) ===
      characterSheetClassFamily(baseClass, catalogEntries)
  );
}

export function classFeatureMetadata({
  definition,
  classLevel,
}: {
  definition: Pick<CharacterSheetCatalogEntry, 'ruleIdentity' | 'detail'>;
  classLevel: number;
}) {
  const detail = definition.detail;
  const fallbackPart = `${classLevel}:${definition.ruleIdentity}`;
  return {
    featureIdentity:
      detail?.kind === 'classFeature'
        ? (detail.parentFeature ?? definition.ruleIdentity)
        : definition.ruleIdentity,
    part:
      detail?.kind === 'classFeature'
        ? (detail.part ?? fallbackPart)
        : fallbackPart,
  };
}
