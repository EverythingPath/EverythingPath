import { remapCatalogReferences } from './catalog-copy-references';
import type {
  CharacterSheetCatalogEntry,
  SheetWarning,
} from './character-sheet';
import { characterSheetClassFamily } from './character-sheet-archetype-helpers';
import type { ResolvedSheetEntry } from './character-sheet-grants';

/**
 * One explicit switch of the definition every level of a class uses (#583).
 *
 * Every level of the class family moves to the chosen definition, as the
 * original/Unchained switch always did (#406). Sheet links to the class's
 * earlier copies of the chosen rule identity (favored classes, casting
 * advances, Archetype bindings, recorded Spells) follow it, so a Catalog Copy
 * switch orphans nothing; links to the other version stay where they are.
 *
 * Row identities, order and every per-level field are kept either way. Grants
 * and dormancy are recalculated from the new definition, never stored.
 */
export type ClassSwitchPlan =
  | { kind: 'unchanged' }
  | {
      kind: 'switch';
      toId: string;
      levelIds: readonly string[];
      /** Earlier copies of the chosen rule identity: every link follows. */
      copyIds: readonly string[];
      /** Earlier definitions of the other version: only the levels move. */
      versionIds: readonly string[];
    }
  | {
      kind: 'refused';
      reason: 'notClassLevel' | 'noClass' | 'notClass' | 'unrelated';
    };

/** A Class Level as both the stored and the calculated sheet rows have it. */
type ClassLevelRow = {
  _id: string;
  kind: 'classLevel';
  state: { classEntryId: string | null; position: number };
};
type SwitchRow = { _id: string; kind: string };

// The sheet's rows are a union discriminated by kind; trust it.
function isClassLevel(row: SwitchRow): row is ClassLevelRow {
  return row.kind === 'classLevel';
}

function classEntryIdOf(row: SwitchRow) {
  return isClassLevel(row) ? row.state.classEntryId : null;
}

export function planClassSwitch({
  entries,
  catalogEntries,
  entryId,
  classEntryId,
}: {
  entries: readonly SwitchRow[];
  catalogEntries: readonly CharacterSheetCatalogEntry[];
  entryId: string;
  classEntryId: string;
}): ClassSwitchPlan {
  const row = entries.find((entry) => entry._id === entryId);
  if (row?.kind !== 'classLevel')
    return { kind: 'refused', reason: 'notClassLevel' };
  const definitionOf = (id: string | null) =>
    catalogEntries.find(
      (definition) =>
        definition._id === id && definition.detail?.kind === 'class',
    );
  const source = definitionOf(classEntryIdOf(row));
  if (!source) return { kind: 'refused', reason: 'noClass' };
  const target = definitionOf(classEntryId);
  if (!target) return { kind: 'refused', reason: 'notClass' };
  const family = characterSheetClassFamily(source, catalogEntries);
  if (family !== characterSheetClassFamily(target, catalogEntries))
    return { kind: 'refused', reason: 'unrelated' };
  const levels = entries
    .filter(isClassLevel)
    .filter((entry) => {
      const definition = definitionOf(entry.state.classEntryId);
      return (
        definition &&
        characterSheetClassFamily(definition, catalogEntries) === family
      );
    })
    .sort((left, right) => left.state.position - right.state.position);
  const earlier = [
    ...new Set(levels.flatMap((entry) => entry.state.classEntryId ?? [])),
  ].filter((id) => id !== target._id);
  if (earlier.length === 0) return { kind: 'unchanged' };
  const isCopy = (id: string) =>
    definitionOf(id)?.ruleIdentity === target.ruleIdentity;
  return {
    kind: 'switch',
    toId: target._id,
    levelIds: levels.map((entry) => entry._id),
    copyIds: earlier.filter(isCopy),
    versionIds: earlier.filter((id) => !isCopy(id)),
  };
}

/** The sheet rows after the switch, as new objects; the input is unchanged. */
export function applyClassSwitch<Row extends SwitchRow>(
  entries: readonly Row[],
  plan: ClassSwitchPlan,
): Row[] {
  if (plan.kind !== 'switch') return [...entries];
  return entries.map((row) => {
    const linked = plan.copyIds.reduce(
      (mapped, copyId) => remapCatalogReferences(mapped, copyId, plan.toId),
      row,
    );
    const current = classEntryIdOf(linked);
    return current &&
      plan.versionIds.includes(current) &&
      plan.levelIds.includes(row._id)
      ? remapCatalogReferences(linked, current, plan.toId)
      : linked;
  });
}

type SwitchCalculation = {
  resolvedEntries: readonly ResolvedSheetEntry[];
  warnings: readonly SheetWarning[];
  warningsForAcceptance: readonly SheetWarning[];
  hp: number | null;
  derivedStatistics: Record<
    'bab' | 'fortitude' | 'reflex' | 'will',
    { total: number }
  >;
};

/** A stored acceptance: the warning's check, subject and facts. */
type AcceptedWarning = { check: string; subject: string; fingerprint: string };
type WarningKey = Pick<AcceptedWarning, 'check' | 'subject'>;

export type ClassSwitchEntryChange = {
  /** The Grant Key id or Selection row id. */
  id: string;
  storedEntryId?: string;
  catalogEntryId?: string;
  name: string;
  origin: ResolvedSheetEntry['origin'];
};

function entryChange(
  row: ResolvedSheetEntry,
  catalogEntries: readonly CharacterSheetCatalogEntry[],
): ClassSwitchEntryChange {
  const catalogEntryId =
    'catalogEntryId' in row.entry ? row.entry.catalogEntryId : undefined;
  const name =
    catalogEntries.find((definition) => definition._id === catalogEntryId)
      ?.name ??
    ('name' in row.entry && typeof row.entry.name === 'string'
      ? row.entry.name
      : 'Entry');
  return {
    id: row.entry._id,
    ...(row.storedEntryId ? { storedEntryId: row.storedEntryId } : {}),
    ...(catalogEntryId ? { catalogEntryId } : {}),
    name,
    origin: row.origin,
  };
}

function countingIds(calculation: Pick<SwitchCalculation, 'resolvedEntries'>) {
  return new Set(
    calculation.resolvedEntries
      .filter((row) => row.counting)
      .map((row) => row.entry._id),
  );
}

/**
 * Entries that counted before and are kept but not counting after. A
 * state-free Grant that is no longer given simply stops appearing.
 */
function dormantRows(before: SwitchCalculation, after: SwitchCalculation) {
  const counted = countingIds(before);
  return after.resolvedEntries.filter(
    (row) =>
      row.dormant &&
      !row.counting &&
      (row.recorded || row.reason?.kind === 'replaced') &&
      counted.has(row.entry._id),
  );
}

/** Entries dormant before that count again after. */
function restoredRows(before: SwitchCalculation, after: SwitchCalculation) {
  const counted = countingIds(before);
  const dormant = new Set(
    before.resolvedEntries
      .filter((row) => row.dormant)
      .map((row) => row.entry._id),
  );
  return after.resolvedEntries.filter(
    (row) =>
      row.counting && !counted.has(row.entry._id) && dormant.has(row.entry._id),
  );
}

function isAccepted(
  warnings: readonly SheetWarning[],
  accepted: AcceptedWarning,
) {
  return warnings.some(
    (warning) =>
      warning.kind === 'rules' &&
      warning.check === accepted.check &&
      warning.subject === accepted.subject &&
      warning.fingerprint === accepted.fingerprint,
  );
}

/**
 * Accepted warnings that applied before: kept while their facts match
 * (`after.warningsForAcceptance` includes what dormant Selections would
 * raise), reopened when a changed warning remains, cleared otherwise.
 */
function triageAcceptedWarnings(
  before: SwitchCalculation,
  after: SwitchCalculation,
  acceptedWarnings: readonly AcceptedWarning[],
) {
  const kept: WarningKey[] = [];
  const reopened: WarningKey[] = [];
  const cleared: WarningKey[] = [];
  for (const accepted of acceptedWarnings) {
    if (!isAccepted(before.warningsForAcceptance, accepted)) continue;
    const key = { check: accepted.check, subject: accepted.subject };
    if (isAccepted(after.warningsForAcceptance, accepted)) kept.push(key);
    else if (
      after.warnings.some(
        (warning) =>
          warning.check === accepted.check &&
          warning.subject === accepted.subject,
      )
    )
      reopened.push(key);
    else cleared.push(key);
  }
  return { kept, reopened, cleared };
}

const statisticKeys = ['bab', 'fortitude', 'reflex', 'will'] as const;

function changedStatistics(
  before: SwitchCalculation,
  after: SwitchCalculation,
) {
  return [
    ...statisticKeys.map((key) => ({
      key,
      before: before.derivedStatistics[key].total,
      after: after.derivedStatistics[key].total,
    })),
    { key: 'hp' as const, before: before.hp, after: after.hp },
  ].filter((row) => row.before !== row.after);
}

/**
 * What a switch recalculates and what it keeps, from the sheet before and
 * after it: the preview before saving and the result afterwards share this.
 * Levels keep their rows; listed statistics changed; dormant entries keep
 * their state until discarded; accepted warnings stay accepted while their
 * facts match, reopen when a changed warning remains, and clear otherwise.
 */
export function describeClassSwitch({
  before,
  after,
  acceptedWarnings,
  catalogEntries,
  levelIds,
}: {
  before: SwitchCalculation;
  after: SwitchCalculation;
  acceptedWarnings: readonly AcceptedWarning[];
  catalogEntries: readonly CharacterSheetCatalogEntry[];
  levelIds: readonly string[];
}) {
  const warnings = triageAcceptedWarnings(before, after, acceptedWarnings);
  return {
    levelIds: [...levelIds],
    statistics: changedStatistics(before, after),
    dormant: dormantRows(before, after).map((row) =>
      entryChange(row, catalogEntries),
    ),
    restored: restoredRows(before, after).map((row) =>
      entryChange(row, catalogEntries),
    ),
    keptWarnings: warnings.kept,
    reopenedWarnings: warnings.reopened,
    clearedWarnings: warnings.cleared,
  };
}
