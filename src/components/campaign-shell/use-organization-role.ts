'use client';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';

/**
 * Whether the viewer administers the organization (#710): only an admin can
 * finish deleting it with Clerk, so only an admin is offered to start.
 * False while the access status loads.
 */
export function useIsOrganizationAdmin(organizationId: string | undefined) {
  const access = useQuery(
    api.user.getOrgAccessStatus,
    organizationId ? { organizationId } : 'skip',
  );
  return access?.state === 'ready' && access.role === 'admin';
}
