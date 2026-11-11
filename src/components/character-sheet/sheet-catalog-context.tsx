'use client';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { CharacterScope } from './character-scope';
import { getScrollBehavior } from './sheet-parts';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import {
  useCharacterSheetCatalog,
  type CatalogDetachTarget,
} from './use-character-sheet-catalog';

export type SheetCatalog = ReturnType<typeof useCharacterSheetCatalog>;
export type CatalogDefinition =
  CharacterSheetSnapshot['catalogEntries'][number];
type SheetCatalogValue = {
  catalog: SheetCatalog;
  /** Null until the sheet's read arrives; the controls stay, disabled. */
  snapshot: CharacterSheetSnapshot | null;
};

const SheetCatalogContext = createContext<SheetCatalogValue | null>(null);

/** The row's switch carries this, so a new one-off can be focused. */
export const entryFocusAttribute = 'data-entry-id';

/**
 * Moves to a Sheet entries row: its switch scrolls into view, respecting
 * reduced motion, and takes focus. False while the row isn't on the page.
 */
export function focusEntryRow(entryId: string) {
  const target = [
    ...document.querySelectorAll<HTMLElement>(`[${entryFocusAttribute}]`),
  ].find((element) => element.getAttribute(entryFocusAttribute) === entryId);
  if (!target) return false;
  target.scrollIntoView?.({ block: 'nearest', behavior: getScrollBehavior() });
  target.focus();
  return true;
}

function findEntryTarget(
  { snapshot }: SheetCatalogValue,
  rowId: string,
): CatalogDetachTarget | undefined {
  if (!snapshot) return undefined;
  const stored = snapshot.entries.find((entry) => entry._id === rowId);
  if (stored) return { kind: 'entry', entryId: stored._id };
  const entry = snapshot.calculated.resolvedEntries.find(
    (resolved) => resolved.entry._id === rowId,
  )?.entry;
  return entry && 'grantKey' in entry && entry.grantKey
    ? { kind: 'grant', grantKey: entry.grantKey }
    : undefined;
}

// A created one-off appears with the live read; its row takes focus once it
// is on the page, then the acknowledgement is spent. Until then every render
// (each new read) looks again.
function useFocusCreatedEntry(catalog: SheetCatalog) {
  const { createdEntryId, acknowledgeCreate } = catalog;
  useEffect(() => {
    if (createdEntryId && focusEntryRow(createdEntryId)) acknowledgeCreate();
  }, [createdEntryId, acknowledgeCreate]);
}

/**
 * The sheet's one Catalog Copies controller, shared by the Catalog block and
 * every row offering definition controls. Without this provider rows render
 * as before; without a snapshot the Catalog block stays, disabled.
 */
export function SheetCatalogProvider({
  scope,
  snapshot,
  children,
}: {
  scope: CharacterScope;
  snapshot: CharacterSheetSnapshot | null | undefined;
  children: ReactNode;
}) {
  const catalog = useCharacterSheetCatalog(scope, snapshot);
  useFocusCreatedEntry(catalog);
  return (
    <SheetCatalogContext.Provider
      value={{ catalog, snapshot: snapshot ?? null }}
    >
      {children}
    </SheetCatalogContext.Provider>
  );
}

export function useSheetCatalog() {
  return useContext(SheetCatalogContext);
}

/** The definition behind a sheet row, Grant or Selection, when it has one. */
export function useRowDefinition(rowId: string) {
  const value = useContext(SheetCatalogContext);
  if (!value) return null;
  const target = findEntryTarget(value, rowId);
  const definition = target
    ? value.catalog.getDefinitionForTarget(target)
    : undefined;
  if (!definition || definition.detail.kind === 'base') return null;
  return { catalog: value.catalog, definition, target };
}
