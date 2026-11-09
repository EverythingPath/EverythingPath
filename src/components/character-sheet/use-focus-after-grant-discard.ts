import { useEffect, useRef, useState } from 'react';
import type {
  GrantEntryView,
  GrantSectionView,
} from './character-sheet-grants-view-model';

function flattenRows(rows: GrantEntryView[]): GrantEntryView[] {
  return rows.flatMap((row) => [row, ...flattenRows(row.replaced)]);
}

type PendingDiscard = {
  rowId: string;
  successorIds: string[];
  headings: HTMLElement[];
  confirmed: boolean;
};

/** Move focus only after this device's successful Discard reaches the live read. */
export function useFocusAfterGrantDiscard(
  sections: GrantSectionView[],
  discard: (row: GrantEntryView) => Promise<boolean>,
) {
  const elements = useRef(new Map<string, HTMLDivElement>());
  const pendingDiscard = useRef<PendingDiscard | null>(null);
  const [completedDiscards, setCompletedDiscards] = useState(0);
  const rows = sections.flatMap((section) =>
    flattenRows([...section.rows, ...section.dormantRows]),
  );

  useEffect(() => {
    const pending = pendingDiscard.current;
    if (!pending?.confirmed) return;
    const row = rows.find((candidate) => candidate.rowId === pending.rowId);
    if (row) {
      if (!row.canDiscard) {
        pendingDiscard.current = null;
        elements.current
          .get(row.rowId)
          ?.querySelector<HTMLElement>('button:not(:disabled)')
          ?.focus();
      }
      return;
    }
    pendingDiscard.current = null;
    const successor = pending.successorIds
      .map((id) => elements.current.get(id))
      .find((element) => element?.isConnected);
    const control = successor?.querySelector<HTMLElement>(
      'button:not(:disabled)',
    );
    if (control) {
      control.focus();
      return;
    }
    const heading = pending.headings.find((element) => element.isConnected);
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [rows, completedDiscards]);

  return {
    registerRow: (rowId: string, element: HTMLDivElement | null) => {
      if (element) elements.current.set(rowId, element);
      else elements.current.delete(rowId);
    },
    discard: async (row: GrantEntryView) => {
      const element = elements.current.get(row.rowId);
      const section = element?.closest('section');
      const sectionHeading = section?.querySelector<HTMLElement>('h2');
      const surroundingHeadings = Array.from(
        (element?.closest('main') ?? document).querySelectorAll<HTMLElement>(
          'h1, h2',
        ),
      ).filter((heading) => heading !== sectionHeading);
      const operation: PendingDiscard = {
        rowId: row.rowId,
        successorIds: rows
          .slice(
            rows.findIndex((candidate) => candidate.rowId === row.rowId) + 1,
          )
          .map((candidate) => candidate.rowId),
        headings: sectionHeading
          ? [sectionHeading, ...surroundingHeadings]
          : surroundingHeadings,
        confirmed: false,
      };
      pendingDiscard.current = operation;
      const succeeded = await discard(row);
      if (pendingDiscard.current === operation) {
        if (succeeded) {
          operation.confirmed = true;
          setCompletedDiscards((count) => count + 1);
        } else pendingDiscard.current = null;
      }
      return succeeded;
    },
  };
}
