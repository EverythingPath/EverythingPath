'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useRef, useState } from 'react';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CatalogCampaignAction } from './catalog-campaign-action';
import { CatalogDefinitionAction } from './catalog-definition-action';
import {
  CatalogDefinitionEditor,
  hasEditableModifiers,
} from './catalog-definition-editor';
import { definitionScopeDescriptions } from './catalog-labels';
import type { CatalogDefinition, SheetCatalog } from './sheet-catalog-context';
import type { CatalogDetachTarget } from './use-character-sheet-catalog';

/**
 * What can be done with a row's definition: its scope in words, then Edit
 * definition, Save to catalog, Customize for campaign and Detach as it
 * allows. After customizing, the campaign copy's editor opens with focus on
 * its Name once the live read carries that copy. Detaching returns focus to the
 * Definition toggle.
 */
export function CatalogDefinitionPanel({
  definition,
  catalog,
  target,
  hasRowEditor = false,
  onReturnFocus,
}: {
  definition: CatalogDefinition;
  catalog: SheetCatalog;
  target?: CatalogDetachTarget;
  hasRowEditor?: boolean;
  onReturnFocus: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const editButton = useRef<HTMLButtonElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [customizedFrom, setCustomizedFrom] =
    useState<Id<'catalogEntry'> | null>(null);
  const capabilities = catalog.capabilitiesFor(definition._id);
  const isDisabled = !catalog.available || maintenance.readOnly;
  const canEditHere =
    capabilities.canEdit &&
    hasEditableModifiers(definition) &&
    !(hasRowEditor && definition.scope === 'character');
  const detachStatus = target
    ? catalog.statusFor(catalog.targetKey(target))
    : undefined;
  return (
    <div className="border-foreground/20 mt-2 space-y-2 border p-3">
      <p className="text-muted-foreground text-xs">
        {definitionScopeDescriptions[definition.scope]}
      </p>
      <ul aria-label={`${definition.name} definition`} className="space-y-2">
        {canEditHere ? (
          <CatalogDefinitionAction
            label="Edit definition"
            subject={definition.name}
            isDisabled={false}
            isPressed={isEditing}
            buttonRef={editButton}
            onClick={() => setIsEditing(!isEditing)}
          />
        ) : null}
        <CatalogCampaignAction
          definition={definition}
          catalog={catalog}
          isDisabled={isDisabled}
          onCustomized={() => {
            setCustomizedFrom(definition._id);
            setIsEditing(true);
          }}
        />
        {target && capabilities.canDetach && detachStatus ? (
          <CatalogDefinitionAction
            label="Detach"
            subject={definition.name}
            description="Keep a separate definition for this character."
            isDisabled={isDisabled || detachStatus.kind === 'saving'}
            status={detachStatus}
            onClick={() =>
              void catalog.detach(target).then((isDetached) => {
                if (isDetached) onReturnFocus();
              })
            }
          />
        ) : null}
      </ul>
      {isEditing && canEditHere ? (
        <CatalogDefinitionEditor
          key={definition._id}
          definition={definition}
          catalog={catalog}
          shouldFocusName={
            definition.campaignPreference === true &&
            definition.copiedFrom === customizedFrom
          }
          onClose={() => {
            setIsEditing(false);
            editButton.current?.focus();
          }}
        />
      ) : null}
      <MaintenanceReason notice={maintenance} />
    </div>
  );
}
