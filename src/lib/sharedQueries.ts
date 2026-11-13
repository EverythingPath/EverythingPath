import { convexQuery } from '@convex-dev/react-query';
import { api as db } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useQuery } from '@tanstack/react-query';

export function useCampaignQuery(orgId: string | undefined, enabled = true) {
  return useQuery(
    convexQuery(
      db.campaign.getCampaigns,
      enabled ? { organizationId: orgId } : 'skip',
    ),
  );
}

export function useCharacterLedgerQuery(
  campaignId: Id<'campaign'> | undefined,
  orgId: string | undefined,
  enabled = true,
  includeInactive = false,
) {
  return useQuery(
    convexQuery(
      db.character.listByCampaign,
      enabled && campaignId && orgId
        ? { campaignId, organizationId: orgId, includeInactive }
        : 'skip',
    ),
  );
}
