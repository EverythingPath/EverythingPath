'use client';
import { Plus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { CatalogBrowser } from './catalog-browser';
import { CatalogOneOffEditor } from './catalog-one-off-editor';
import { useSheetCatalog } from './sheet-catalog-context';
import { action, Block, RemoteNotice } from './sheet-parts';

/**
 * The sheet's Catalog block: Create one-off for a definition only this
 * Character uses, and the accessible catalog with each definition's
 * controls. Rows elsewhere on the sheet carry the same controls for the
 * definitions they use. Until the sheet's catalog is available its controls
 * stay in place, disabled.
 */
export function CharacterSheetCatalog() {
  const value = useSheetCatalog();
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  const createButton = useRef<HTMLButtonElement>(null);
  const [isCreating, setIsCreating] = useState(false);
  if (!value) return null;
  const { catalog } = value;
  return (
    <MaintenanceReasonScope id={reasonId}>
      <Block title="Catalog">
        <div className="space-y-2">
          <RemoteNotice
            isShown={catalog.hasRemoteChange}
            message="Another player changed these definitions. Your edits are kept."
            subject="definitions"
            onDismiss={catalog.dismissRemoteChange}
          />
          {isCreating ? (
            <CatalogOneOffEditor
              catalog={catalog}
              onClose={() => {
                // Enable Create one-off before it takes focus back.
                flushSync(() => setIsCreating(false));
                createButton.current?.focus();
              }}
            />
          ) : null}
          <Button
            ref={createButton}
            type="button"
            size="sm"
            variant="outline"
            className={action}
            aria-describedby={maintenance.readOnly ? reasonId : undefined}
            disabled={!catalog.available || maintenance.readOnly || isCreating}
            onClick={() => setIsCreating(true)}
          >
            <Plus aria-hidden className="size-4" />
            Create one-off
          </Button>
          <CatalogBrowser catalog={catalog} />
          <MaintenanceReason id={reasonId} notice={maintenance} />
        </div>
      </Block>
    </MaintenanceReasonScope>
  );
}
