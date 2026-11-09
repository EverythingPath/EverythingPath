import { describeRetiredChoice } from './retired-catalog-choices';
import {
  selectionMetadata,
  orderedSelectionIdsAtLevel,
  buildSelectionEntry,
  replaceRecordedSelection,
} from '~/lib/character-sheet-selection';
import type { SheetEntry, SheetWarning } from '~/lib/character-sheet';
import {
  prerequisiteLabel,
  type Prerequisite,
  type PrerequisiteCheck,
} from '~/lib/character-sheet-prerequisites';
import type {
  CharacterSheetSnapshot,
  SheetWarningView,
} from './use-character-sheet';
import type { FillSelectionSlotInput } from './use-character-sheet-selections';
import {
  ignoresPrerequisites,
  recordedPosition,
  buildRecordedPrerequisiteSources,
} from '~/lib/character-sheet-proficiency-prerequisites';
import { calculateCharacterSheetPreview } from './calculate-character-sheet-preview';

type StoredSelection = Extract<
  Exclude<CharacterSheetSnapshot['entries'][number], { kind: 'base' }>,
  { catalogEntryId: string }
>;
function isStoredSelection(
  entry: CharacterSheetSnapshot['entries'][number],
): entry is StoredSelection {
  return 'catalogEntryId' in entry && entry.kind !== 'base';
}

type CatalogSelection = Extract<SheetEntry, { catalogEntryId: string }> &
  Exclude<SheetEntry, { kind: 'base' }>;

function isCatalogSelection(entry: SheetEntry): entry is CatalogSelection {
  return 'catalogEntryId' in entry && entry.kind !== 'base';
}

type RequirementStatus = 'met' | 'unmet' | 'none' | 'exempt' | null;

function acceptedWarning(
  snapshot: Pick<CharacterSheetSnapshot, 'acceptedWarnings'>,
  warning: SheetWarning,
): SheetWarningView {
  return {
    ...warning,
    accepted:
      warning.kind === 'rules' &&
      snapshot.acceptedWarnings.some(
        (accepted) =>
          accepted.check === warning.check &&
          accepted.subject === warning.subject &&
          accepted.fingerprint === warning.fingerprint,
      ),
  };
}

function requirementStatus(
  checks: readonly PrerequisiteCheck[],
  exempt = false,
): RequirementStatus {
  if (exempt) return 'exempt';
  if (checks.some((check) => check.met === false)) return 'unmet';
  if (checks.some((check) => check.met === null)) return null;
  return checks.length ? 'met' : 'none';
}

function readableProse(clauses: readonly Prerequisite[]): string[] {
  return clauses.flatMap((clause) =>
    'unchecked' in clause
      ? [clause.unchecked]
      : 'anyOf' in clause
        ? readableProse(clause.anyOf)
        : [],
  );
}

function selectionGuidance(
  catalog: CharacterSheetSnapshot['catalogEntries'][number],
) {
  return catalog.guidanceText ?? '';
}

function selectionPrerequisiteText(
  catalog: CharacterSheetSnapshot['catalogEntries'][number],
) {
  return (
    catalog.prerequisiteText ??
    readableProse(catalog.prerequisites ?? []).join('; ')
  );
}

function entryChecks(
  calculated: Pick<CharacterSheetSnapshot['calculated'], 'prerequisites'>,
  entryId: string,
): PrerequisiteCheck[] {
  return calculated.prerequisites.filter((check) => check.entryId === entryId);
}

function isCurrentWarning(warning: SheetWarning, entryId: string) {
  return (
    warning.check === 'prerequisites.current' ||
    (warning.check === 'proficiencyPrerequisite' &&
      warning.subject.startsWith(`${entryId}:current:`))
  );
}

function isRecordedWarning(warning: SheetWarning, entryId: string) {
  return (
    warning.check === 'prerequisites.recordedLevel' ||
    (warning.check === 'proficiencyPrerequisite' &&
      warning.subject.startsWith(`${entryId}:recorded:`))
  );
}

/** The same prerequisite groups accompany every row, including prestige entry. */
export function buildEntryPrerequisiteView({
  snapshot,
  entryId,
  recordedLevelPosition = null,
  exempt = false,
  warnings: warningSource = snapshot.calculated.warnings,
}: {
  snapshot: Pick<
    CharacterSheetSnapshot,
    'acceptedWarnings' | 'catalogEntries'
  > & {
    calculated: Pick<
      CharacterSheetSnapshot['calculated'],
      'prerequisites' | 'warnings'
    >;
  };
  entryId: string;
  recordedLevelPosition?: number | null;
  exempt?: boolean;
  warnings?: readonly SheetWarning[];
}) {
  const checks = entryChecks(snapshot.calculated, entryId);
  const labeledChecks = checks
    .filter((check) => check.met !== null)
    .map((check) => ({
      ...check,
      label: prerequisiteLabel(check.clause, snapshot.catalogEntries),
    }));
  const warnings = warningSource
    .filter(
      (warning) =>
        warning.target.kind === 'entry' && warning.target.entryId === entryId,
    )
    .map((warning) => acceptedWarning(snapshot, warning));
  return {
    recordedLevelLabel:
      recordedLevelPosition === null
        ? null
        : `Prerequisites at recorded level ${recordedLevelPosition}`,
    currentStatus: requirementStatus(
      checks.filter((check) => check.view === 'current'),
      exempt,
    ),
    recordedStatus:
      recordedLevelPosition === null
        ? null
        : requirementStatus(
            checks.filter((check) => check.view === 'recorded'),
            exempt,
          ),
    checks: labeledChecks,
    currentChecks: labeledChecks.filter((check) => check.view === 'current'),
    recordedChecks: labeledChecks.filter((check) => check.view === 'recorded'),
    warnings,
    currentWarnings: warnings.filter((warning) =>
      isCurrentWarning(warning, entryId),
    ),
    recordedWarnings: warnings.filter((warning) =>
      isRecordedWarning(warning, entryId),
    ),
    otherWarnings: warnings.filter(
      (warning) =>
        !isCurrentWarning(warning, entryId) &&
        !isRecordedWarning(warning, entryId),
    ),
  };
}

type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];

/**
 * What the feat and trait pickers can offer. With the read's catalog choices
 * (`readCatalogChoices`: the Character's, its campaign's and global
 * definitions, projected through the selected Catalog Release, admitted ones
 * only under an active release, held ones listed in `heldDefinitionIds`),
 * exactly those, in the sheet's version for the same ID. A definition the
 * sheet holds only by reference is not offered again, and no original is
 * offered beside its campaign's preferred copy
 * (docs/character-sheet/catalog-scopes.md). While the choices load, the
 * sheet's own definitions, as before.
 */
function selectionCatalog(
  snapshot: CharacterSheetSnapshot,
  catalogChoices: readonly CatalogEntry[] | undefined,
) {
  if (!catalogChoices) return snapshot.catalogEntries;
  const sheetVersions = new Map(
    snapshot.catalogEntries.map((entry) => [entry._id, entry]),
  );
  const offered = [
    ...new Map(
      catalogChoices.map((entry) => [
        entry._id,
        sheetVersions.get(entry._id) ?? entry,
      ]),
    ).values(),
  ];
  const replaced = new Set<string>(
    offered.flatMap((entry) =>
      entry.scope === 'campaign' && entry.campaignPreference && entry.copiedFrom
        ? [entry.copiedFrom]
        : [],
    ),
  );
  return offered.filter(
    (entry) => !(entry.scope === 'global' && replaced.has(entry._id)),
  );
}

export function buildCharacterSheetSelectionsView(
  snapshot: CharacterSheetSnapshot,
  catalogChoices?: readonly CatalogEntry[],
) {
  const warnings = snapshot.calculated.warnings.map((warning) =>
    acceptedWarning(snapshot, warning),
  );
  const slots = snapshot.calculated.selectionRules.slots;
  const levels = snapshot.entries
    .filter((entry) => entry.kind === 'classLevel' && entry.active)
    .map((entry) => ({
      entryId: entry._id,
      position: entry.state.position,
      label: `${entry.state.position} · ${snapshot.catalogEntries.find((catalog) => catalog._id === entry.state.classEntryId)?.name ?? 'Unspecified'}`,
    }));
  const base = snapshot.entries.find((entry) => entry.kind === 'base');
  const prerequisiteInput = {
    ...snapshot,
    characterKind: snapshot.character.kind,
    entries: [
      ...snapshot.entries.filter(
        (entry) =>
          entry.active &&
          (entry.kind === 'base' || entry.kind === 'classLevel'),
      ),
      ...snapshot.calculated.resolvedEntries
        .filter((resolved) => resolved.counting)
        .map(({ entry }) => entry),
    ],
  };
  const recordedInput = { ...snapshot, characterKind: snapshot.character.kind };
  const sources = buildRecordedPrerequisiteSources({
    input: recordedInput,
    effectiveInput: prerequisiteInput,
  });
  const levelOrders = new Map(
    levels.map((level) => [
      level.entryId,
      orderedSelectionIdsAtLevel(snapshot.entries, level.entryId),
    ]),
  );
  const storedSelections = new Map<string, StoredSelection>(
    snapshot.entries
      .filter(isStoredSelection)
      .map((entry) => [entry._id, entry]),
  );
  const allRows = snapshot.calculated.resolvedEntries.flatMap((resolved) => {
    const entry = resolved.entry;
    if (!isCatalogSelection(entry)) return [];
    const stored =
      resolved.storedEntryId === undefined
        ? undefined
        : storedSelections.get(resolved.storedEntryId);
    const catalog = snapshot.catalogEntries.find(
      (definition) => definition._id === entry.catalogEntryId,
    );
    const isMagicalLineage =
      entry.kind === 'trait' &&
      catalog?.ruleIdentity === 'pf1-content/kDx6ZGhbIteoi7lG';
    const choice =
      'choice' in entry.state ? (entry.state.choice ?? null) : null;
    const exempt = ignoresPrerequisites(entry, prerequisiteInput);
    const recordedLevel = levels.find(
      (level) => level.entryId === stored?.gainedAtClassLevel,
    );
    const position = recordedPosition({
      entry,
      input: recordedInput,
      effectiveInput: prerequisiteInput,
      sources,
      levelOrders,
    });
    const order = recordedLevel
      ? levelOrders.get(recordedLevel.entryId)
      : undefined;
    const orderIndex = stored ? (order?.indexOf(stored._id) ?? -1) : -1;
    const canMove =
      resolved.origin === 'selection' &&
      stored !== undefined &&
      orderIndex >= 0;
    return [
      {
        rowId: entry._id,
        entryId: stored?._id ?? null,
        kind: entry.kind,
        name: catalog?.name ?? 'Unavailable entry',
        description: catalog?.description ?? '',
        guidanceText: catalog ? selectionGuidance(catalog) : '',
        origin: resolved.origin,
        active: entry.active,
        dormant: resolved.dormant,
        counting: resolved.counting,
        kept: 'kept' in entry && entry.kept === true,
        canRemove: resolved.origin === 'selection' && stored !== undefined,
        canEdit: resolved.origin === 'selection' && stored !== undefined,
        slot: stored?.selectionSlot ?? null,
        choice,
        choiceLabel: isMagicalLineage ? 'Chosen spell' : 'Choice',
        choiceIncomplete: isMagicalLineage && !choice?.trim(),
        choiceGuidance: isMagicalLineage
          ? 'Apply the metamagic adjustment manually.'
          : '',
        notes: stored?.notes ?? '',
        gainedAtClassLevel: stored?.gainedAtClassLevel ?? null,
        choiceOrder: stored?.choiceOrder ?? null,
        orderPosition: canMove ? orderIndex + 1 : null,
        orderCount: canMove ? (order?.length ?? 0) : 0,
        canMoveEarlier: canMove && orderIndex > 0,
        canMoveLater: canMove && orderIndex < (order?.length ?? 0) - 1,
        ...buildEntryPrerequisiteView({
          snapshot,
          entryId: entry._id,
          recordedLevelPosition: position?.classLevel ?? null,
          exempt,
        }),
        prerequisiteText: catalog ? selectionPrerequisiteText(catalog) : '',
      },
    ];
  });
  const rows = allRows.filter(
    (row): row is typeof row & { kind: 'feat' | 'trait' } =>
      row.kind === 'feat' || row.kind === 'trait',
  );
  return {
    allRows,
    budgets: snapshot.calculated.selectionRules.budgets,
    slots: slots.map((slot) => ({
      ...slot,
      rows: rows.filter((row) => row.slot?.id === slot.id),
    })),
    rows,
    candidates: selectionCatalog(snapshot, catalogChoices).flatMap((entry) => {
      if (entry.detail.kind !== 'feat' && entry.detail.kind !== 'trait')
        return [];
      return [
        {
          catalogEntryId: entry._id,
          name: entry.name,
          unavailableReason: describeRetiredChoice(snapshot, entry),
          kind: entry.detail.kind,
          description: entry.description ?? '',
          guidanceText: selectionGuidance(entry),
          prerequisiteText: selectionPrerequisiteText(entry),
        },
      ];
    }),
    levels,
    facts: {
      alignment: base?.state.alignment ?? null,
      deity: base?.state.deity ?? null,
    },
    warnings: warnings.filter((warning) =>
      snapshot.calculated.selectionRules.warnings.some(
        (candidate) =>
          candidate.check === warning.check &&
          candidate.subject === warning.subject &&
          candidate.fingerprint === warning.fingerprint,
      ),
    ),
  };
}

/** Preview crosses the same calculation seam as the saved sheet. Failed checks remain advisory. */
export function previewSelectionSlot(
  sheet: CharacterSheetSnapshot,
  input: FillSelectionSlotInput,
  catalogChoices?: readonly CatalogEntry[],
) {
  const slot = sheet.calculated.selectionRules.slots.find(
    (slot) => slot.id === input.slotId,
  );
  const catalog = selectionCatalog(sheet, catalogChoices).find(
    (entry) => entry._id === input.catalogEntryId,
  );
  if (!slot || catalog?.detail.kind !== slot.kind) return null;
  // A catalog choice the sheet doesn't hold yet calculates with it, as the
  // server does once the Selection loads it.
  const snapshot = sheet.catalogEntries.includes(catalog)
    ? sheet
    : { ...sheet, catalogEntries: [...sheet.catalogEntries, catalog] };
  const previous = snapshot.entries.find(
    (entry): entry is StoredSelection =>
      (entry.kind === 'feat' || entry.kind === 'trait') &&
      !entry.grantKey &&
      entry.selectionSlot?.id === input.slotId &&
      entry.selectionSlot.position === input.position,
  );
  const entryId = previous?._id ?? 'preview:selection';
  const metadata = selectionMetadata({
    entries: snapshot.entries,
    previous,
    input,
  });
  const { gainedAtClassLevel } = metadata;
  const source = slot.grantedBy
    ? {
        kind: 'slot' as const,
        grantedBy: slot.grantedBy,
        slotIndex: slot.slotIndex,
      }
    : undefined;
  const candidate: SheetEntry = {
    _id: entryId,
    ...buildSelectionEntry({
      kind: slot.kind,
      catalogEntryId: catalog._id,
      slotId: slot.id,
      position: input.position,
      choice: input.choice,
      source,
    }),
    ...metadata,
  };
  const calculated = calculateCharacterSheetPreview(snapshot, {
    entries: replaceRecordedSelection<SheetEntry>(snapshot.entries, candidate),
  });
  const baselineWarningKeys = new Set(
    snapshot.calculated.selectionRules.warnings.map((warning) =>
      JSON.stringify([warning.check, warning.subject, warning.fingerprint]),
    ),
  );
  const warnings = calculated.warnings.filter(
    (warning) =>
      (warning.target.kind === 'entry' && warning.target.entryId === entryId) ||
      calculated.selectionRules.warnings.some(
        (candidate) =>
          candidate === warning &&
          !baselineWarningKeys.has(
            JSON.stringify([
              warning.check,
              warning.subject,
              warning.fingerprint,
            ]),
          ),
      ),
  );
  const recordedLevel = snapshot.entries.find(
    (entry) =>
      entry.kind === 'classLevel' &&
      entry.active &&
      entry._id === gainedAtClassLevel,
  );
  const groups = buildEntryPrerequisiteView({
    snapshot: { ...snapshot, calculated },
    entryId,
    recordedLevelPosition:
      recordedLevel?.kind === 'classLevel'
        ? recordedLevel.state.position
        : null,
    exempt: slot.ignoresPrerequisites,
    warnings,
  });
  return {
    catalogEntryId: catalog._id,
    name: catalog.name,
    ...groups,
    prerequisiteText: selectionPrerequisiteText(catalog),
    guidanceText: selectionGuidance(catalog),
    description: catalog.description ?? '',
    warnings,
    otherWarnings: warnings.filter(
      (warning) =>
        !isCurrentWarning(warning, entryId) &&
        !isRecordedWarning(warning, entryId),
    ),
    isSelectable: true,
  };
}

/** A sheet revision reuses previews until its inputs change. */
export function createSelectionSlotPreview(
  snapshot: CharacterSheetSnapshot | null | undefined,
  catalogChoices?: readonly CatalogEntry[],
) {
  const previews = new Map<string, ReturnType<typeof previewSelectionSlot>>();
  return (input: FillSelectionSlotInput) => {
    if (!snapshot) return null;
    const key = JSON.stringify(input);
    if (previews.has(key)) return previews.get(key) ?? null;
    const preview = previewSelectionSlot(snapshot, input, catalogChoices);
    // Browsing and editing a long catalog keeps a bounded set of projections.
    if (previews.size >= 32) previews.clear();
    previews.set(key, preview);
    return preview;
  };
}

export type CharacterSheetSelectionRow = ReturnType<
  typeof buildCharacterSheetSelectionsView
>['allRows'][number];
