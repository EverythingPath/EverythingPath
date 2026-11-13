'use client';
import { usePaginatedQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useOrganizationDeletion } from '~/components/campaign-shell/use-organization-deletion';
import { useIsOrganizationAdmin } from '~/components/campaign-shell/use-organization-role';
import { isOrganizationDeleting } from './organization-deletion-banner';

const deletedPageSize = 25;

/**
 * The campaign list's deletion state (#710): the organization's own deletion,
 * whether the viewer is an admin who can finish it, and its deleted
 * campaigns a page at a time.
 */
export function useCampaignHomeDeletions(organizationId: string) {
  const organizationDeletion = useOrganizationDeletion({ organizationId });
  const isAdmin = useIsOrganizationAdmin(organizationId);
  const deleted = usePaginatedQuery(
    api.campaignDeletions.list,
    { organizationId },
    { initialNumItems: deletedPageSize },
  );
  return {
    organizationDeletion,
    isAdmin,
    isDeleting: isOrganizationDeleting(organizationDeletion.deletion),
    deleted: {
      rows: deleted.results,
      canLoadMore: deleted.status === 'CanLoadMore',
      loadMore: () => deleted.loadMore(deletedPageSize),
    },
  };
}
