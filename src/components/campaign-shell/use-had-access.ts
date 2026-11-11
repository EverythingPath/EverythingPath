'use client';
import { useState } from 'react';

/**
 * Whether this session has seen the member's access to the organization, so
 * a later refusal reads as the organization going away (#710) rather than as
 * access they never had.
 */
export function useHadAccess(
  organizationId: string | undefined,
  hasAccess: boolean,
) {
  const [seen, setSeen] = useState<string | null>(null);
  if (hasAccess && organizationId !== undefined && seen !== organizationId)
    setSeen(organizationId);
  return organizationId !== undefined && seen === organizationId;
}
