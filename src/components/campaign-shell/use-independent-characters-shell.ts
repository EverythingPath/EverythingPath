'use client';

import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { api } from '@convex/_generated/api';
import { useOrganization } from '@clerk/nextjs';
import { useConvexAuth } from 'convex/react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  resolveNavigationLocation,
  readCharacterSheetOrigin,
} from '~/lib/campaign-routes';
import { useCampaignQuery } from '~/lib/sharedQueries';
import { useCampaignShellNavigation } from './use-campaign-shell-navigation';

/** Origin access and the active organization's picker remain independently scoped. */
export function useIndependentCharactersShell() {
  const pathname = usePathname();
  const params = useSearchParams();
  const origin = readCharacterSheetOrigin(params);
  const location = origin && resolveNavigationLocation(origin.href);
  const { organization } = useOrganization();
  const auth = useConvexAuth();
  const sheet = resolveNavigationLocation(pathname);
  const characterId =
    sheet?.kind === 'character-sheet' && sheet.characterId !== 'new'
      ? sheet.characterId
      : undefined;
  const snapshot = useQuery({
    ...convexQuery(
      api.characterSheet.read,
      characterId && auth.isAuthenticated && location?.kind === 'campaign'
        ? { characterId }
        : 'skip',
    ),
    throwOnError: false,
  });
  const sheetCampaign = snapshot.error ? undefined : snapshot.data?.campaign;
  const source = origin?.organization;
  const originOrganizationId =
    (source?.kind === 'organization' ? source.id : undefined) ??
    (location?.kind === 'campaign' &&
    sheetCampaign?.campaignId === location.campaignId
      ? sheetCampaign.organizationId
      : organization?.id);
  const query = useCampaignQuery(
    organization?.id,
    auth.isAuthenticated && Boolean(organization),
  );
  const originQuery = useCampaignQuery(
    originOrganizationId,
    auth.isAuthenticated &&
      location?.kind === 'campaign' &&
      Boolean(originOrganizationId),
  );
  const campaigns =
    auth.isAuthenticated && query.data?.state === 'ready'
      ? query.data.campaigns
      : [];
  const originCampaigns =
    auth.isAuthenticated && originQuery.data?.state === 'ready'
      ? originQuery.data.campaigns
      : [];
  const campaign =
    location?.kind === 'campaign'
      ? originCampaigns.find((item) => item._id === location.campaignId)
      : undefined;
  const nav = useCampaignShellNavigation({
    campaign,
    campaigns,
    organizationId: organization?.id,
  });
  return { nav, origin, isSheet: sheet?.kind === 'character-sheet' };
}
