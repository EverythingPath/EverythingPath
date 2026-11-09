import type { SheetWarning } from './character-sheet';
import type { ResolvedSheetEntry } from './character-sheet-grants';

// Owner (#583): dormancy alone never takes a warning's acceptance away. A
// Selection that fills a slot or prompt the sheet no longer has is dormant
// and raises nothing; the warnings it would raise, and those it shares with
// counting entries such as `featDuplicate`, keep their acceptance while their
// facts match. Changed facts still reopen them.

type Row = {
  _id: string;
  selectionSource?: unknown;
  selectionSlot?: unknown;
  state?: object;
};

/**
 * The rows with each dormant slot or prompt Selection counting again as an
 * ordinary Selection, or null when there is none to revive.
 */
export function withDormantSelectionsCounting<Entry extends Row>(
  entries: readonly Entry[],
  resolvedEntries: readonly ResolvedSheetEntry[],
): Entry[] | null {
  const dormant = new Set(
    resolvedEntries.flatMap((row) =>
      row.origin === 'selection' &&
      row.dormant &&
      row.reason?.kind === 'sourceMissing' &&
      row.storedEntryId
        ? [row.storedEntryId]
        : [],
    ),
  );
  const revived = entries.filter(
    (entry) =>
      dormant.has(entry._id) &&
      (entry.selectionSource !== undefined ||
        entry.selectionSlot !== undefined),
  );
  if (revived.length === 0) return null;
  // A feat also records its slot binding in its state.
  return entries.map((entry) =>
    revived.includes(entry)
      ? {
          ...entry,
          selectionSource: undefined,
          selectionSlot: undefined,
          ...(entry.state && 'slot' in entry.state
            ? { state: { ...entry.state, slot: undefined } }
            : {}),
        }
      : entry,
  );
}

/**
 * The warnings an accepted warning may match to keep its acceptance: the
 * sheet's own, and those it would raise with its dormant Selections counting.
 */
export function warningsForAcceptanceThroughDormancy<Entry extends Row>({
  entries,
  calculated,
  calculate,
}: {
  entries: readonly Entry[];
  calculated: {
    resolvedEntries: readonly ResolvedSheetEntry[];
    warningsForAcceptance: readonly SheetWarning[];
  };
  calculate: (entries: Entry[]) => readonly SheetWarning[];
}): readonly SheetWarning[] {
  const revived = withDormantSelectionsCounting(
    entries,
    calculated.resolvedEntries,
  );
  return revived
    ? [...calculated.warningsForAcceptance, ...calculate(revived)]
    : calculated.warningsForAcceptance;
}
