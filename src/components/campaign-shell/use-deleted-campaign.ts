'use client';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { zid } from 'convex-helpers/server/zod4';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@convex/_generated/api';

export type DeletedCampaign = NonNullable<
  FunctionReturnType<typeof api.campaignDeletions.status>
>;

export type DeletedCampaignRead =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'deleted'; deletion: DeletedCampaign };

/**
 * Whether a campaign missing from the active organization's list was deleted
 * (#710), so its finished weeks can still be read. The id comes from the
 * address: one that isn't a campaign id is never sent, and reads as "not
 * deleted" like any other unavailable campaign, as does a failed read.
 */
export function useDeletedCampaign(campaignId: string): DeletedCampaignRead {
  const parsed = zid('campaign').safeParse(campaignId);
  const query = useQuery(
    convexQuery(
      api.campaignDeletions.status,
      parsed.success ? { campaignId: parsed.data } : 'skip',
    ),
  );
  if (!parsed.success) return { kind: 'none' };
  if (query.isPending) return { kind: 'loading' };
  const deletion = query.data;
  if (
    query.isError ||
    !deletion ||
    (deletion.state !== 'deleted' && deletion.state !== 'purging')
  )
    return { kind: 'none' };
  return { kind: 'deleted', deletion };
}
