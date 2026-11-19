'use client';
import { useEffect, useRef, useState } from 'react';

type PendingRemoval = {
  entryId: string;
  successorIds: string[];
  confirmed: boolean;
};

// A row marks the control that takes focus (its check or Remove); the
// phone-only name button is hidden from tablet width and cannot hold it.
const focusable = '[data-removal-focus]:not(:disabled)';

/**
 * After this device removes a recorded Spell and the row leaves the live
 * read, focus moves to the next row's first control, else the previous
 * row's, else the list's block heading. A failed removal leaves focus where
 * it was, on the row that still stands.
 */
export function useFocusAfterSpellRemoval(entryIds: readonly string[]) {
  const container = useRef<HTMLDivElement>(null);
  const pending = useRef<PendingRemoval | null>(null);
  const [completedRemovals, setCompletedRemovals] = useState(0);
  const entryKey = entryIds.join('\n');

  useEffect(() => {
    const removal = pending.current;
    if (!removal?.confirmed) return;
    if (entryKey.split('\n').includes(removal.entryId)) return;
    pending.current = null;
    const root = container.current;
    if (!root) return;
    const rows = Array.from(
      root.querySelectorAll<HTMLElement>('[data-spell-entry]'),
    );
    for (const id of removal.successorIds) {
      const control = rows
        .find((row) => row.dataset.spellEntry === id)
        ?.querySelector<HTMLElement>(focusable);
      if (control) {
        control.focus();
        return;
      }
    }
    const heading = root
      .closest('section')
      ?.querySelector<HTMLElement>('h2, h3');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }, [entryKey, completedRemovals]);

  return {
    container,
    remove: async (entryId: string, write: () => Promise<boolean>) => {
      const index = entryIds.indexOf(entryId);
      const removal: PendingRemoval = {
        entryId,
        successorIds: [
          ...entryIds.slice(index + 1),
          ...entryIds.slice(0, Math.max(index, 0)).reverse(),
        ],
        confirmed: false,
      };
      pending.current = removal;
      const removed = await write();
      if (pending.current !== removal) return removed;
      if (!removed) {
        pending.current = null;
        return removed;
      }
      removal.confirmed = true;
      setCompletedRemovals((count) => count + 1);
      return removed;
    },
  };
}
