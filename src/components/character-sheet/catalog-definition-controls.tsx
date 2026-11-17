'use client';
import { ChevronRight } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { CatalogCopyAdvisory } from './catalog-copy-advisory';
import { CatalogDefinitionPanel } from './catalog-definition-panel';
import { definitionScopeLabels } from './catalog-labels';
import type { CatalogDefinition, SheetCatalog } from './sheet-catalog-context';
import type { CatalogDetachTarget } from './use-character-sheet-catalog';

/**
 * A definition's scope, its changed-original notice and a Definition toggle
 * opening its controls beneath. Global content stays read-only; base scores
 * have no controls.
 */
export function CatalogDefinitionControls({
  definition,
  catalog,
  target,
  hasRowEditor,
  className,
}: {
  definition: CatalogDefinition;
  catalog: SheetCatalog;
  /** The row this definition is used by; Detach needs one. */
  target?: CatalogDetachTarget;
  /** The row's own editor already edits its Character definition. */
  hasRowEditor?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  if (definition.detail.kind === 'base') return null;
  const advisory = catalog.advisories?.find(
    (notice) => notice.catalogEntryId === definition._id,
  );
  return (
    <div className={cn('mt-1', className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-muted-foreground font-mono text-xs">
          {definitionScopeLabels[definition.scope]}
        </span>
        <Button
          ref={toggle}
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-11 gap-1 px-1.5 font-mono text-xs md:h-7"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen(!isOpen)}
        >
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3.5 transition-transform',
              isOpen && 'rotate-90',
            )}
          />
          Definition <span className="sr-only">{definition.name}</span>
        </Button>
      </div>
      {advisory ? (
        <CatalogCopyAdvisory originalName={advisory.originalName} />
      ) : null}
      <div id={panelId}>
        {isOpen ? (
          <CatalogDefinitionPanel
            definition={definition}
            catalog={catalog}
            target={target}
            hasRowEditor={hasRowEditor}
            onReturnFocus={() => toggle.current?.focus()}
          />
        ) : null}
      </div>
    </div>
  );
}
