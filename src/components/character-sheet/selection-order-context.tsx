'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { SelectionControls, SelectionsView } from './selection-view-types';

type SelectionOrderValue = {
  controls: SelectionControls;
  view: Pick<SelectionsView, 'allRows' | 'levels'>;
};

const SelectionOrderContext = createContext<SelectionOrderValue | null>(null);

/**
 * The sheet's Selection controller for the rows other blocks present, so a
 * class feature, racial trait or item moves within its level like a feat.
 * Without this provider rows still show their prerequisite groups, but no
 * order controls.
 */
export function SelectionOrderProvider({
  controls,
  view,
  children,
}: SelectionOrderValue & { children: ReactNode }) {
  return (
    <SelectionOrderContext.Provider value={{ controls, view }}>
      {children}
    </SelectionOrderContext.Provider>
  );
}

export function useSelectionOrder() {
  return useContext(SelectionOrderContext);
}

/** A presentation's Selection row by stored entry or resolved row ID. */
export function useSelectionRow(id: string | null | undefined) {
  const value = useContext(SelectionOrderContext);
  if (!value || !id) return undefined;
  return value.view.allRows.find(
    (row) => row.entryId === id || row.rowId === id,
  );
}
