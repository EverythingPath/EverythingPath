'use client';
import { ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { CatalogDefinitionBrowser } from './catalog-definition-browser';
import type { SheetCatalog } from './sheet-catalog-context';
import { action } from './sheet-parts';

/** Browse catalog: a disclosure over the definitions Add to sheet offers. */
export function CatalogBrowser({ catalog }: { catalog: SheetCatalog }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="border-foreground/10 border-t pt-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          action,
          'text-muted-foreground hover:text-foreground gap-1 px-1.5 font-mono text-xs',
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn('size-3.5 transition-transform', isOpen && 'rotate-90')}
        />
        Browse catalog
      </Button>
      <div id={panelId}>
        {isOpen ? <CatalogDefinitionBrowser catalog={catalog} /> : null}
      </div>
    </div>
  );
}
