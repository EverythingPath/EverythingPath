'use client';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { CharactersSection } from '~/components/campaign-sections/characters-section';
import { CharactersPageFrame } from '~/components/campaign-sections/page-frames';

export default function OfficersPage() {
  const { campaign, organizationId } = useCampaign();
  return (
    <CharactersPageFrame>
      <CharactersSection
        campaignId={campaign._id}
        organizationId={organizationId}
      />
    </CharactersPageFrame>
  );
}
