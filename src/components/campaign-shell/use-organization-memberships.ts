'use client';

import { useOrganizationList } from '@clerk/nextjs';
import { useEffect } from 'react';

/** Owned Characters may belong to any membership page, not only the first. */
export function useOrganizationMemberships() {
  const list = useOrganizationList({ userMemberships: { infinite: true } });
  const memberships = list.userMemberships;
  const fetchNext =
    list.isLoaded && memberships?.hasNextPage && !memberships.isFetching
      ? memberships.fetchNext
      : undefined;
  useEffect(() => {
    void fetchNext?.();
  }, [fetchNext]);
  return memberships?.data ?? [];
}
