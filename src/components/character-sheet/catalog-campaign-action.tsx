'use client';
import { CatalogDefinitionAction } from './catalog-definition-action';
import type { CatalogDefinition, SheetCatalog } from './sheet-catalog-context';

/**
 * Save to catalog for a Character definition, Customize for campaign for a
 * global one; each explains the campaign it needs when there is none.
 */
export function CatalogCampaignAction({
  definition,
  catalog,
  isDisabled,
  onCustomized,
}: {
  definition: CatalogDefinition;
  catalog: SheetCatalog;
  isDisabled: boolean;
  onCustomized: () => void;
}) {
  const capabilities = catalog.capabilitiesFor(definition._id);
  const status = catalog.statusFor(definition._id);
  const isBusy = isDisabled || status.kind === 'saving';
  if (definition.scope === 'character')
    return (
      <CatalogDefinitionAction
        label="Save to catalog"
        subject={definition.name}
        description={
          capabilities.canSaveToCatalog
            ? 'Share this definition with the campaign.'
            : 'Save to catalog requires a campaign.'
        }
        isDisabled={isBusy || !capabilities.canSaveToCatalog}
        status={status}
        onClick={() => void catalog.saveToCatalog(definition._id)}
      />
    );
  if (definition.scope === 'global')
    return (
      <CatalogDefinitionAction
        label="Customize for campaign"
        subject={definition.name}
        description={
          capabilities.canCustomizeForCampaign
            ? 'Characters in this campaign using this definition will use the campaign copy.'
            : 'Customize for campaign requires a campaign.'
        }
        isDisabled={isBusy || !capabilities.canCustomizeForCampaign}
        status={status}
        onClick={() =>
          void catalog
            .customizeForCampaign(definition._id)
            .then((isCustomized) => {
              if (isCustomized) onCustomized();
            })
        }
      />
    );
  return null;
}
