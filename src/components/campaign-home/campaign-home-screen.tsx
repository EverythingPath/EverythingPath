'use client';
import { useParams } from 'next/navigation';
import { decodeRouteSegment } from '~/lib/campaign-routes';
import { CampaignHomeStatus } from './campaign-home-status';
import { CampaignHomeView } from './campaign-home-view';
import type { Organization } from './home-state';
import type { Doc } from '@convex/_generated/dataModel';
import {
  useCampaignHomeList,
  useCampaignHomeSelection,
} from './use-campaign-home';

function ReadyCampaignHome({
  organization,
  campaigns,
  requested,
}: {
  organization: Organization;
  campaigns: Doc<'campaign'>[];
  requested: string | null;
}) {
  const home = useCampaignHomeSelection({
    organization,
    campaigns,
    requested,
  });
  return (
    <CampaignHomeView
      organization={organization}
      campaigns={campaigns}
      home={home}
    />
  );
}

// The campaign list and the selected campaign's home, for `/campaigns` and
// `/campaigns/<id>`. Everything local (create form, selection wait, header
// editors) is keyed by the organization, so an organization change starts
// from its own list with nothing carried over.
export function CampaignHomeScreen() {
  const params = useParams<{ campaignId?: string }>();
  const requested = params.campaignId
    ? decodeRouteSegment(params.campaignId)
    : null;
  const { list, retry } = useCampaignHomeList();
  if (list.kind !== 'ready')
    return (
      <CampaignHomeStatus list={list} requested={requested} retry={retry} />
    );
  return (
    <ReadyCampaignHome
      key={list.organization.id}
      organization={list.organization}
      campaigns={list.campaigns}
      requested={requested}
    />
  );
}
