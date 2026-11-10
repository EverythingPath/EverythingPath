'use client';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { AddFromMyCharacters } from '~/components/character-navigation/add-from-my-characters';
import { CampaignCharactersView } from '~/components/character-navigation/campaign-characters-view';
import { CharactersListLoading } from '~/components/character-navigation/characters-list-loading';
import { useCampaignCharacters } from '~/components/character-navigation/use-character-lists';
export default function CharactersPage() {
  const { campaign, organizationId } = useCampaign();
  const { characters, newHref } = useCampaignCharacters({
    campaignId: campaign._id,
    organizationId,
  });
  return characters === undefined ? (
    <CharactersListLoading />
  ) : (
    <CampaignCharactersView
      campaignName={campaign.name}
      scope={{ campaignId: campaign._id, organizationId }}
      characters={characters}
      addFromMine={
        // Only prepared fixture campaigns take moved Characters (#316).
        campaign.e2eFixture ? (
          <AddFromMyCharacters
            campaignId={campaign._id}
            campaignName={campaign.name}
            organizationId={organizationId}
          />
        ) : undefined
      }
      newHref={newHref}
    />
  );
}
