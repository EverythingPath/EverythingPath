'use client';
import { useId, useState } from 'react';
import { Input } from '~/components/ui/input';
import { isSelectableCatalogSheetEntryKind } from '~/lib/character-sheet-entries';
import { CatalogDefinitionRow } from './catalog-definition-row';
import type { CatalogDefinition, SheetCatalog } from './sheet-catalog-context';
import { fieldLabel } from './sheet-parts';

const shownDefinitionLimit = 25;

// The kinds `canSelect` accepts: Base scores and Classes are never generic
// Selections, so they are not cards here.
function listSelectableDefinitions(definitions: CatalogDefinition[]) {
  return definitions.filter((definition) =>
    isSelectableCatalogSheetEntryKind(definition.detail.kind),
  );
}

function listMatchingDefinitions(
  definitions: CatalogDefinition[],
  search: string,
) {
  const needle = search.trim().toLocaleLowerCase();
  return definitions
    .filter((definition) =>
      definition.name.toLocaleLowerCase().includes(needle),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

// A copy made with Customize for campaign takes its original's place in the
// list. Keeping the original's key keeps that card's open controls, so the
// campaign copy's editor opens from the live read.
function findCardKey(definition: CatalogDefinition, listedIds: Set<string>) {
  const original = definition.campaignPreference
    ? definition.copiedFrom
    : undefined;
  return original && !listedIds.has(original) ? original : definition._id;
}

/**
 * The accessible definitions Add to sheet can offer, preferred copies in
 * place of their originals, filtered by name. Nothing is invented while the
 * list is loading.
 */
export function CatalogDefinitionBrowser({
  catalog,
}: {
  catalog: SheetCatalog;
}) {
  const [search, setSearch] = useState('');
  const searchId = useId();
  const { definitions } = catalog;
  const selectable = definitions
    ? listSelectableDefinitions(definitions)
    : undefined;
  if (selectable?.length === 0)
    return (
      <p role="status" className="text-muted-foreground text-sm">
        No catalog entries available.
      </p>
    );
  const listedIds = new Set<string>(selectable?.map(({ _id }) => _id));
  const matches = listMatchingDefinitions(selectable ?? [], search);
  const shown = matches.slice(0, shownDefinitionLimit);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={searchId} className={fieldLabel}>
        Search catalog
      </label>
      <Input
        id={searchId}
        type="search"
        autoComplete="off"
        value={selectable ? search : ''}
        disabled={!selectable}
        className="h-11 md:h-8"
        onChange={(event) => setSearch(event.target.value)}
      />
      {!selectable ? (
        <p role="status" className="text-muted-foreground text-sm">
          Loading catalog…
        </p>
      ) : shown.length === 0 ? (
        <p role="status" className="text-muted-foreground text-sm">
          No matching entries.
        </p>
      ) : (
        <ul
          aria-label="Catalog entries"
          className="divide-foreground/10 divide-y"
        >
          {shown.map((definition) => (
            <CatalogDefinitionRow
              key={findCardKey(definition, listedIds)}
              definition={definition}
              catalog={catalog}
            />
          ))}
        </ul>
      )}
      {matches.length > shown.length ? (
        <p className="text-muted-foreground text-xs">
          Showing {shown.length} of {matches.length}. Search to narrow the list.
        </p>
      ) : null}
    </div>
  );
}
