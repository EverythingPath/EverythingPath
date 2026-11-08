'use client';

import { useParams } from 'next/navigation';
import { decodeRouteSegment } from '~/lib/campaign-routes';
import { useCampaignQuery } from '~/lib/sharedQueries';
import { useSession } from './session';
import { useCampaignShellNavigation } from './use-campaign-shell-navigation';

export function useListShellNavigation() {
  const params = useParams<{ campaignId?: string }>();
  const session = useSession();
  const organization =
    session.kind === 'member' ? session.organization : undefined;
  const query = useCampaignQuery(organization?.id, Boolean(organization));
  const campaigns =
    organization && query.data?.state === 'ready' ? query.data.campaigns : [];
  const requested = params?.campaignId && decodeRouteSegment(params.campaignId);
  const campaign = campaigns.find((item) => item._id === requested);
  return useCampaignShellNavigation({
    campaign,
    campaigns,
    organizationId: organization?.id,
  });
}
