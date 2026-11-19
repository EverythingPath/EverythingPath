'use client';
import { CatalogDefinitionControls } from './catalog-definition-controls';
import { useRowDefinition } from './sheet-catalog-context';
import type { CatalogDetachTarget } from './use-character-sheet-catalog';

/** A sheet row's definition controls, resolved from the live read. */
export function RowCatalogDefinition({
  rowId,
  target,
  hasRowEditor,
  className,
}: {
  rowId: string;
  target?: CatalogDetachTarget;
  hasRowEditor?: boolean;
  className?: string;
}) {
  const row = useRowDefinition(rowId);
  if (!row) return null;
  return (
    <CatalogDefinitionControls
      definition={row.definition}
      catalog={row.catalog}
      target={target ?? row.target}
      hasRowEditor={hasRowEditor}
      className={className}
    />
  );
}
