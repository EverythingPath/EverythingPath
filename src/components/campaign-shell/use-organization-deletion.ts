'use client';
import { useRef, useState } from 'react';
import { useOrganization } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  classifyDeletionFailure,
  type DeletionRequestStatus,
} from '~/lib/container-deletion';

/**
 * An app-controlled organization deletion (#710). An admin asks for it; every
 * campaign then returns its Characters and is deleted, and the deletion is
 * `ready`. Finishing deletes the organization with Clerk, whose event
 * completes it on the server. Only the active organization can be finished
 * from here, because Clerk deletes the organization it hands out.
 */
export function useOrganizationDeletion({
  organizationId,
}: {
  organizationId: string;
}) {
  const request = useMutation(api.organizationDeletions.request);
  /** Undefined while loading; null when none was requested or no access. */
  const deletion = useQuery(api.organizationDeletions.status, {
    organizationId,
  });
  const { organization } = useOrganization();
  const [state, setState] = useState<{
    organizationId: string;
    status: DeletionRequestStatus;
  }>({ organizationId, status: { kind: 'idle' } });
  const status: DeletionRequestStatus =
    state.organizationId === organizationId ? state.status : { kind: 'idle' };
  const inFlight = useRef<string | null>(null);

  async function run(command: () => Promise<unknown>) {
    if (inFlight.current === organizationId) return false;
    inFlight.current = organizationId;
    setState({ organizationId, status: { kind: 'pending' } });
    try {
      await command();
      setState({ organizationId, status: { kind: 'idle' } });
      return true;
    } catch (error) {
      setState({ organizationId, status: classifyDeletionFailure(error) });
      return false;
    } finally {
      if (inFlight.current === organizationId) inFlight.current = null;
    }
  }

  const canFinish =
    deletion?.state === 'ready' && organization?.id === organizationId;

  return {
    deletion,
    status,
    /** Resolves true once the deletion is under way. */
    submit: () => run(() => request({ organizationId })),
    canFinish,
    /** Delete the organization with Clerk once every campaign is deleted. */
    finish: () =>
      canFinish && organization
        ? run(() => organization.destroy())
        : Promise.resolve(false),
  };
}
