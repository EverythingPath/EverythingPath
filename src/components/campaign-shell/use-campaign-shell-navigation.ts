'use client';

import { api } from '@convex/_generated/api';
import type { Doc } from '@convex/_generated/dataModel';
import { useConvexAuth, useQuery } from 'convex/react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { NavigationCampaign } from '~/lib/app-navigation';
import { useAppNavigation } from './use-app-navigation';

/** Militia existence is independent of whether its first week has been initialized. */
export function useCampaignShellNavigation({
  campaign,
  campaigns,
  organizationId,
  week,
}: {
  campaign?: Doc<'campaign'>;
  campaigns: Doc<'campaign'>[];
  organizationId?: string;
  week?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams()?.toString() ?? '';
  const auth = useConvexAuth();
  const contexts = useQuery(
    api.campaign.listNavigationContexts,
    organizationId && auth.isAuthenticated ? { organizationId } : 'skip',
  );
  const originContexts = useQuery(
    api.campaign.listNavigationContexts,
    campaign &&
      campaign.organizationId !== organizationId &&
      auth.isAuthenticated
      ? { organizationId: campaign.organizationId }
      : 'skip',
  );
  const campaignContexts =
    campaign?.organizationId === organizationId ? contexts : originContexts;
  const campaignContext = campaignContexts?.find(
    (context) => context.campaignId === campaign?._id,
  );
  const places: NavigationCampaign[] = campaigns.map((item) => ({
    id: item._id,
    name: item.name,
    hasMilitia:
      contexts === undefined
        ? 'loading'
        : (contexts.find((context) => context.campaignId === item._id)
            ?.hasMilitia ?? false),
  }));
  const place: NavigationCampaign | undefined = campaign
    ? {
        id: campaign._id,
        name: campaign.name,
        hasMilitia:
          campaignContexts === undefined
            ? 'loading'
            : (campaignContext?.hasMilitia ?? false),
      }
    : undefined;
  return useAppNavigation({
    pathname,
    searchParams,
    organizationId,
    campaigns: places,
    campaign: place,
    week: week ?? campaignContext?.week,
  });
}
