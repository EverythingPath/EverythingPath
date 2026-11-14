'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { focusEntryRow } from './sheet-catalog-context';

// A notice elsewhere on the sheet leads to an entry's row (#583). A row
// under a collapsed "Not counting now" group isn't on the page, so the
// group that holds it opens first; the row takes focus once it is shown.

type Group = { rowIds: readonly string[]; open: () => void };
type RevealValue = {
  groups: Map<symbol, Group>;
  pendingRowId: string | null;
  setPendingRowId: (rowId: string | null) => void;
};

const RevealEntryRowContext = createContext<RevealValue | null>(null);

/** The sheet's collapsed groups, so a notice can open the one it needs. */
export function RevealEntryRowProvider({ children }: { children: ReactNode }) {
  const groups = useRef(new Map<symbol, Group>());
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const value = useMemo(
    () => ({ groups: groups.current, pendingRowId, setPendingRowId }),
    [pendingRowId],
  );
  return (
    <RevealEntryRowContext.Provider value={value}>
      {children}
    </RevealEntryRowContext.Provider>
  );
}

/**
 * Moves to an entry's row, opening the collapsed group that holds it.
 * Without the provider it only focuses a row already on the page.
 */
export function useRevealEntryRow() {
  const value = useContext(RevealEntryRowContext);
  return useCallback(
    (rowId: string) => {
      if (focusEntryRow(rowId) || !value) return;
      const group = [...value.groups.values()].find((candidate) =>
        candidate.rowIds.includes(rowId),
      );
      if (!group) return;
      value.setPendingRowId(rowId);
      group.open();
    },
    [value],
  );
}

/**
 * A collapsed group's part: it opens when one of its rows is asked for, and
 * that row takes focus once the open group shows it.
 */
export function useRevealTarget({
  rowIds,
  isOpen,
  open,
}: {
  rowIds: readonly string[];
  isOpen: boolean;
  open: () => void;
}) {
  const value = useContext(RevealEntryRowContext);
  const [key] = useState(() => Symbol('reveal-target'));
  const rowKey = rowIds.join('\n');
  useEffect(() => {
    if (!value) return;
    value.groups.set(key, { rowIds: rowKey.split('\n'), open });
    return () => {
      value.groups.delete(key);
    };
  }, [value, key, rowKey, open]);
  const pendingRowId = value?.pendingRowId ?? null;
  const setPendingRowId = value?.setPendingRowId;
  useEffect(() => {
    if (
      !isOpen ||
      pendingRowId === null ||
      !rowKey.split('\n').includes(pendingRowId)
    )
      return;
    if (focusEntryRow(pendingRowId)) setPendingRowId?.(null);
  }, [isOpen, pendingRowId, rowKey, setPendingRowId]);
}
