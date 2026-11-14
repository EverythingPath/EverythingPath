import type { CharacterSheetSelectionRow } from './character-sheet-selections-view-model';
import type { CharacterSheetInput, SheetEntry } from '~/lib/character-sheet';
import type {
  GrantKey,
  ResolvedSheetEntry,
} from '~/lib/character-sheet-grants';

export type GrantEntryTarget = { grantKey: GrantKey } | { entryId: string };

export type GrantEntryView = {
  rowId: string;
  selection?: CharacterSheetSelectionRow;
  target: GrantEntryTarget;
  name: string;
  kind: SheetEntry['kind'];
  origin: ResolvedSheetEntry['origin'];
  recorded: boolean;
  active: boolean;
  kept: boolean;
  dormant: boolean;
  counting: boolean;
  gainedAtClassLevel: string | null;
  unplaced: boolean;
  status: 'counting' | 'kept' | 'off' | 'dormant';
  choice: string | null;
  notes: string;
  sourceLabel: string | null;
  reason: string | null;
  canKeep: boolean;
  canDiscard: boolean;
  canEditChoice: boolean;
  replaced: GrantEntryView[];
};

export type GrantSectionView = {
  kind: SheetEntry['kind'];
  title: string;
  rows: GrantEntryView[];
  dormantRows: GrantEntryView[];
  dormantLabel: string;
};

type GrantSectionKind = Exclude<
  SheetEntry['kind'],
  'base' | 'classLevel' | 'attackRoutine'
>;
const sectionKinds: GrantSectionKind[] = [
  'race',
  'racialTrait',
  'archetype',
  'classFeature',
  'feat',
  'trait',
  'manual',
  'item',
  'spell',
  'spellEffect',
  'condition',
  'abilityDamage',
  'abilityDrain',
];
const sectionTitles: Record<GrantSectionKind, string> = {
  race: 'Race',
  racialTrait: 'Racial traits',
  archetype: 'Archetypes',
  classFeature: 'Class features',
  feat: 'Feats',
  trait: 'Traits',
  manual: 'Personal adjustments',
  item: 'Items',
  spell: 'Spells',
  spellEffect: 'Spell Effects',
  condition: 'Conditions',
  abilityDamage: 'Ability damage',
  abilityDrain: 'Ability drain',
};
const regularKinds: SheetEntry['kind'][] = [
  'race',
  'racialTrait',
  'archetype',
  'classFeature',
  'feat',
  'trait',
];

/** Why a dormant row doesn't count, in the row's own words. */
function describeDormantReason(
  reason: ResolvedSheetEntry['reason'],
  names: ReadonlyMap<string, string>,
) {
  switch (reason?.kind) {
    case undefined:
      return null;
    case 'replaced':
      return `Replaced by ${reason.byEntryIds.map((id) => names.get(id) ?? 'Unavailable entry').join(', ')}`;
    case 'retired':
      return 'Retired from the catalog before this Character had it, so it cannot be kept.';
    case 'sourceMissing':
      return 'Its source is no longer active.';
  }
}

/** Existing effect panels own their regular rows; every section retains lost state here. */
export function buildCharacterSheetGrantsView({
  entries,
  catalogEntries,
  classLevelIds = new Set(),
  selectionRows = [],
}: {
  entries: readonly ResolvedSheetEntry[];
  catalogEntries: CharacterSheetInput['catalogEntries'];
  classLevelIds?: ReadonlySet<string>;
  selectionRows?: readonly CharacterSheetSelectionRow[];
}): GrantSectionView[] {
  const names = new Map(
    entries.map(({ entry }) => [
      entry._id,
      catalogEntries.find(
        (catalog) =>
          catalog._id ===
          ('catalogEntryId' in entry ? entry.catalogEntryId : undefined),
      )?.name ?? 'Unavailable entry',
    ]),
  );
  const rows = new Map<string, GrantEntryView>();
  for (const resolved of entries) {
    const { entry, reason } = resolved;
    if (
      entry.kind === 'base' ||
      entry.kind === 'classLevel' ||
      entry.kind === 'attackRoutine'
    )
      continue;
    const grantKey = 'grantKey' in entry ? entry.grantKey : undefined;
    // Keep cannot bring back a retired target the Character never had (#411).
    const isRetired = reason?.kind === 'retired';
    const kept = 'kept' in entry && entry.kept === true && !isRetired;
    const gainedAtClassLevel =
      'gainedAtClassLevel' in entry ? entry.gainedAtClassLevel : undefined;
    const source = catalogEntries.find(
      (catalog) => catalog.ruleIdentity === grantKey?.source,
    );
    const parentName = grantKey ? names.get(grantKey.source) : undefined;
    rows.set(entry._id, {
      rowId: entry._id,
      selection: selectionRows.find((row) => row.rowId === entry._id),
      target: grantKey
        ? { grantKey }
        : { entryId: resolved.storedEntryId ?? entry._id },
      name: names.get(entry._id) ?? 'Unavailable entry',
      kind: entry.kind,
      origin: resolved.origin,
      recorded: resolved.recorded,
      active: entry.active,
      kept,
      dormant: resolved.dormant,
      counting: resolved.counting,
      gainedAtClassLevel: gainedAtClassLevel ?? null,
      unplaced:
        resolved.origin === 'selection' &&
        resolved.counting &&
        !resolved.dormant &&
        gainedAtClassLevel !== undefined &&
        !classLevelIds.has(gainedAtClassLevel),
      status: !entry.active
        ? 'off'
        : resolved.dormant
          ? kept
            ? 'kept'
            : 'dormant'
          : 'counting',
      choice: 'choice' in entry.state ? (entry.state.choice ?? null) : null,
      notes: ('notes' in entry ? entry.notes : undefined) ?? '',
      sourceLabel:
        parentName ??
        (source
          ? `${source.name}${grantKey?.classLevel ? ` ${grantKey.classLevel}` : ''}`
          : null),
      reason: describeDormantReason(reason, names),
      canKeep: resolved.dormant && !isRetired,
      canDiscard: resolved.dormant && resolved.recorded,
      canEditChoice: [
        'race',
        'racialTrait',
        'archetype',
        'classFeature',
        'feat',
        'trait',
        'manual',
      ].includes(entry.kind),
      replaced: [],
    });
  }
  const nested = new Set<string>();
  for (const resolved of entries) {
    if (resolved.reason?.kind !== 'replaced') continue;
    const row = rows.get(resolved.entry._id);
    const replacer = resolved.reason.byEntryIds
      .map((id) => rows.get(id))
      .find((parent) => parent && !parent.dormant);
    if (row && replacer) {
      replacer.replaced.push(row);
      nested.add(row.rowId);
    }
  }
  return sectionKinds.flatMap((kind) => {
    const sectionRows = [...rows.values()].filter(
      (row) => row.kind === kind && !nested.has(row.rowId),
    );
    const regular = sectionRows.filter((row) =>
      row.dormant
        ? row.kept
        : row.origin === 'grant' || regularKinds.includes(row.kind),
    );
    const dormantRows = sectionRows.filter(
      (row) => row.dormant && row.recorded && !row.kept,
    );
    if (!regular.length && !dormantRows.length) return [];
    return [
      {
        kind,
        title: sectionTitles[kind],
        rows: regular,
        dormantRows,
        dormantLabel: `Not counting now (${dormantRows.length})`,
      },
    ];
  });
}
