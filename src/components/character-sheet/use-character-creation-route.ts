'use client';

import { api } from '@convex/_generated/api';
import { useOrganization } from '@clerk/nextjs';
import { useConvexAuth, useQuery } from 'convex/react';
import { useSearchParams } from 'next/navigation';
import {
  resolveCharacterSheetBack,
  readCharacterSheetOrigin,
} from '~/lib/campaign-routes';
import { useCampaignQuery } from '~/lib/sharedQueries';

/** Campaign identity comes from the authorized list, never a cast of URL input. */
export function useCharacterCreationRoute() {
  const params = useSearchParams();
  const campaignId = params?.get('campaignId');
  const origin = readCharacterSheetOrigin(params);
  const back = resolveCharacterSheetBack(origin);
  const auth = useConvexAuth();
  const user = useQuery(api.user.getMe, auth.isAuthenticated ? {} : 'skip');
  const { organization } = useOrganization();
  const query = useCampaignQuery(
    organization?.id,
    Boolean(campaignId && organization && auth.isAuthenticated),
  );
  const campaign =
    campaignId && query.data?.state === 'ready'
      ? query.data.campaigns.find((item) => item._id === campaignId)
      : undefined;
  return {
    back,
    origin,
    campaign: campaign ?? undefined,
    organizationId: campaign ? organization?.id : undefined,
    loading:
      user === undefined ||
      Boolean(
        campaignId && organization && query.data === undefined && !query.error,
      ),
    available: campaignId
      ? Boolean(campaign?.e2eFixture)
      : Boolean(user?.characterSheetDemo),
  };
}
