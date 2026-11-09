'use client';
import { CatalogDefinitionControls } from './catalog-definition-controls';
import { definitionKindLabels } from './catalog-labels';
import { CatalogSelectionControl } from './catalog-selection-control';
import type { CatalogDefinition, SheetCatalog } from './sheet-catalog-context';
import { chip } from './sheet-parts';

/** One catalog card: its name and kind, Add to sheet and its controls. */
export function CatalogDefinitionRow({
  definition,
  catalog,
}: {
  definition: CatalogDefinition;
  catalog: SheetCatalog;
}) {
  return (
    <li aria-label={definition.name} className="py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 className="font-sans text-base [overflow-wrap:anywhere]">
          {definition.name}
        </h3>
        <span className={chip}>
          {definitionKindLabels[definition.detail.kind]}
        </span>
      </div>
      <CatalogSelectionControl definition={definition} catalog={catalog} />
      <CatalogDefinitionControls definition={definition} catalog={catalog} />
    </li>
  );
}
