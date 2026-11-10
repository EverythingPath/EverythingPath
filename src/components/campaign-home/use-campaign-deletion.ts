'use client';
import { useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import {
  classifyDeletionFailure,
  type DeletionRequestStatus,
} from '~/lib/container-deletion';

/**
 * A campaign's deletion (#710): its progress for every member and the
 * request to start it. The request is refused with counts while Characters
 * need an owner; after members assign them, requesting again goes on. A
 * repeated request returns the deletion already under way, so retrying an
 * unconfirmed request is safe.
 */
export function useCampaignDeletion({
  campaignId,
  organizationId,
}: {
  campaignId: Id<'campaign'>;
  organizationId: string;
}) {
  const request = useMutation(api.campaignDeletions.request);
  /** Undefined while loading; null when no deletion was requested. */
  const deletion = useQuery(api.campaignDeletions.status, { campaignId });
  const scopeKey = `${organizationId}/${campaignId}`;
  const [state, setState] = useState<{
    scopeKey: string;
    status: DeletionRequestStatus;
  }>({ scopeKey, status: { kind: 'idle' } });
  const status: DeletionRequestStatus =
    state.scopeKey === scopeKey ? state.status : { kind: 'idle' };
  const inFlight = useRef<string | null>(null);

  /** Resolves true once the deletion is under way or done. */
  async function submit() {
    if (inFlight.current === scopeKey) return false;
    inFlight.current = scopeKey;
    setState({ scopeKey, status: { kind: 'pending' } });
    try {
      await request({ campaignId, organizationId });
      setState({ scopeKey, status: { kind: 'idle' } });
      return true;
    } catch (error) {
      setState({ scopeKey, status: classifyDeletionFailure(error) });
      return false;
    } finally {
      if (inFlight.current === scopeKey) inFlight.current = null;
    }
  }

  return {
    deletion,
    status,
    submit,
    /** Characters are returning or the deletion is paused for owners. */
    isUnderWay:
      deletion?.state === 'returning' || deletion?.state === 'blocked',
    /** The campaign is gone; only its history remains. */
    isDeleted: deletion?.state === 'purging' || deletion?.state === 'deleted',
  };
}
