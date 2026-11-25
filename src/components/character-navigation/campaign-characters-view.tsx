'use client';
import type { ReactNode } from 'react';
import { CampaignDeletionBanner } from '~/components/campaign-home/campaign-deletion-banner';
import { useCampaignDeletion } from '~/components/campaign-home/use-campaign-deletion';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type { CampaignScope } from '~/lib/campaign-scope';
import { CampaignCharactersTable } from './campaign-characters-table';
import { pageClass } from './character-list-classes';
import type { CampaignCharacterListRow } from './character-list-model';
import { CharactersTitle } from './characters-title';

/** How many Characters nobody owns (#708), above the table; none says nothing. */
function needsOwnerSummary(count: number) {
  if (count === 0) return null;
  return count === 1
    ? 'One Character needs an owner.'
    : `${count} Characters need an owner.`;
}

// A campaign's Characters page: everyone's, with owner, state and roster,
// and the player's own ways to bring Characters here.
export function CampaignCharactersView({
  campaignName,
  scope,
  characters,
  addFromMine,
  newHref,
}: {
  campaignName: string;
  scope: CampaignScope;
  characters: CampaignCharacterListRow[];
  /** Add from my characters, where this campaign takes moved Characters. */
  addFromMine?: ReactNode;
  newHref?: string;
}) {
  const maintenance = useInitialMigrationMaintenance();
  // Owners are assigned right here, so the banner offers no link (#710).
  const campaignDeletion = useCampaignDeletion(scope);
  const needingOwner = needsOwnerSummary(
    characters.filter((character) => character.needsOwner).length,
  );
  return (
    <main className={pageClass}>
      <CharactersTitle
        eyebrow={campaignName}
        actions={addFromMine}
        newHref={newHref}
      />
      <div className="mb-3 empty:hidden">
        <CampaignDeletionBanner
          campaignDeletion={campaignDeletion}
          assignHref={null}
        />
      </div>
      <p className="text-muted-foreground mb-3 text-sm">
        Everyone in {campaignName} can edit these.
      </p>
      {needingOwner ? (
        <p className="text-muted-foreground mb-3 text-sm">{needingOwner}</p>
      ) : null}
      {characters.length ? <MaintenanceReason notice={maintenance} /> : null}
      {characters.length ? (
        <CampaignCharactersTable characters={characters} scope={scope} />
      ) : (
        <p className="text-muted-foreground py-5 text-sm">
          No characters in this campaign yet.
        </p>
      )}
    </main>
  );
}
