import type { SelectionReference } from './character-sheet-grants';
import type { SheetEntry } from './character-sheet';

type RecordedSelection<LevelId extends string> = {
  _id: string;
  kind: SheetEntry['kind'];
  active: boolean;
  gainedAtClassLevel?: LevelId;
  choiceOrder?: number;
  notes?: string;
};

const undatedKinds = new Set<SheetEntry['kind']>([
  'base',
  'race',
  'item',
  'manual',
  'condition',
  'spellEffect',
  'abilityDamage',
  'abilityDrain',
]);

export function isUndatedSheetEntry(entry: Pick<SheetEntry, 'kind'>) {
  return undatedKinds.has(entry.kind);
}

/** Missing orders use the recorded row's place within its level. */
export function selectionOrdersAtLevel<LevelId extends string>(
  entries: readonly RecordedSelection<LevelId>[],
  levelId: LevelId,
) {
  const positions = new Map<string, { order: number; index: number }>();
  for (const entry of entries) {
    if (
      entry.gainedAtClassLevel !== levelId ||
      !entry.active ||
      isUndatedSheetEntry(entry) ||
      ('grantKey' in entry && entry.grantKey)
    )
      continue;
    const index = positions.size;
    positions.set(entry._id, { order: entry.choiceOrder ?? index, index });
  }
  return positions;
}

export function orderedSelectionIdsAtLevel<LevelId extends string>(
  entries: readonly RecordedSelection<LevelId>[],
  levelId: LevelId,
): string[] {
  return [...selectionOrdersAtLevel(entries, levelId)]
    .sort(([, a], [, b]) => a.order - b.order || a.index - b.index)
    .map(([id]) => id);
}

/** New recorded levels append in the order Selections are added. */
export function selectionMetadata<LevelId extends string>({
  entries,
  previous,
  input,
}: {
  entries: readonly RecordedSelection<LevelId>[];
  previous?: RecordedSelection<LevelId>;
  input: {
    gainedAtClassLevel?: LevelId | null;
    choiceOrder?: number | null;
    notes?: string;
  };
}) {
  const gainedAtClassLevel =
    input.gainedAtClassLevel === null
      ? undefined
      : (input.gainedAtClassLevel ?? previous?.gainedAtClassLevel);
  const changedLevel = gainedAtClassLevel !== previous?.gainedAtClassLevel;
  const orders = gainedAtClassLevel
    ? [...selectionOrdersAtLevel(entries, gainedAtClassLevel)]
        .filter(([id]) => id !== previous?._id)
        .map(([, position]) => position.order)
    : [];
  const choiceOrder =
    input.choiceOrder !== undefined
      ? (input.choiceOrder ?? undefined)
      : previous && !changedLevel
        ? previous.choiceOrder
        : gainedAtClassLevel
          ? Math.max(-1, ...orders) + 1
          : undefined;
  return {
    gainedAtClassLevel,
    choiceOrder,
    notes: input.notes ?? previous?.notes,
  };
}

/** The preview and saved slot share the same Selection state. */
export function buildSelectionEntry<
  CatalogId extends string,
  Reference extends SelectionReference,
>({
  kind,
  catalogEntryId,
  slotId,
  position,
  choice,
  source,
}: {
  kind: 'feat' | 'trait';
  catalogEntryId: CatalogId;
  slotId?: string;
  position?: number;
  choice?: string | null;
  source?: { kind: 'slot'; grantedBy: Reference; slotIndex?: number };
}) {
  const common = {
    active: true,
    catalogEntryId,
    ...(slotId !== undefined && position !== undefined
      ? { selectionSlot: { id: slotId, position } }
      : {}),
    ...(source ? { selectionSource: source } : {}),
  };
  return kind === 'feat'
    ? {
        ...common,
        kind: 'feat' as const,
        state: {
          kind: 'feat' as const,
          choice: choice ?? null,
          slot: source
            ? { grantedBy: source.grantedBy, slotIndex: source.slotIndex }
            : ('general' as const),
        },
      }
    : {
        ...common,
        kind: 'trait' as const,
        state: { kind: 'trait' as const, choice: choice ?? null },
      };
}

/** Replacing recorded state retains the fallback addition order. */
export function replaceRecordedSelection<Entry extends { _id: string }>(
  entries: readonly Entry[],
  candidate: Entry,
): Entry[] {
  return entries.some((entry) => entry._id === candidate._id)
    ? entries.map((entry) => (entry._id === candidate._id ? candidate : entry))
    : [...entries, candidate];
}
