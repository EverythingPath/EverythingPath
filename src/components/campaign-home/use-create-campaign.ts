'use client';
import { useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { CreateCampaignValues } from '~/lib/campaign-fields';
import { classifyWriteFailure } from '~/lib/write-outcome';

export type CreateStatus =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'rejected'; message: string | null }
  | { kind: 'unknown' };

/** What the create form needs: the request status and a submit. */
export type CreateCampaign = {
  status: CreateStatus;
  /** Resolves true once the campaign was created. */
  submit: (values: CreateCampaignValues) => Promise<boolean>;
};

export type CreateCampaignRequest = {
  status: CreateStatus;
  /** The created campaign's id, or null when it was refused, unconfirmed or already pending. */
  submit: (values: CreateCampaignValues) => Promise<Id<'campaign'> | null>;
};

// One request at a time for the organization this hook was mounted for; a
// later organization never receives it. An unconfirmed result is reported
// as such and is never retried or matched by name: creating again is the
// player's explicit choice.
export function useCreateCampaign({
  organizationId,
}: {
  organizationId: string;
}): CreateCampaignRequest {
  const create = useMutation(api.campaign.createCampaign);
  const [status, setStatus] = useState<CreateStatus>({ kind: 'idle' });
  const inFlight = useRef(false);
  async function submit(values: CreateCampaignValues) {
    if (inFlight.current) return null;
    inFlight.current = true;
    setStatus({ kind: 'pending' });
    try {
      const campaignId = await create({
        name: values.name,
        description: values.description,
        organizationId,
      });
      setStatus({ kind: 'idle' });
      return campaignId;
    } catch (error) {
      const failure = classifyWriteFailure(error);
      setStatus(
        failure.kind === 'rejected'
          ? { kind: 'rejected', message: failure.message }
          : { kind: 'unknown' },
      );
      return null;
    } finally {
      inFlight.current = false;
    }
  }
  return { status, submit };
}
