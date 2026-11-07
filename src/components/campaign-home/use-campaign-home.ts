'use client';
import { useHadAccess } from '~/components/campaign-shell/use-had-access';
import { useEffect, useRef, useState } from 'react';
import type { Doc } from '@convex/_generated/dataModel';
import { useCampaignQuery } from '~/lib/sharedQueries';
import { campaignPath } from '~/lib/campaign-routes';
import { useNavigationGuard } from '~/components/campaign-shell/navigation-guard';
import { useSession } from '~/components/campaign-shell/session';
import {
  classifyList,
  resolveSelection,
  type HomeList,
  type HomeSelection,
  type Opening,
  type Organization,
} from './home-state';
import { useCreateCampaign, type CreateCampaign } from './use-create-campaign';

export type CampaignHomeList = { list: HomeList; retry: () => void };

/** The active organization's authorized campaign list, once the session settles. */
export function useCampaignHomeList(): CampaignHomeList {
  const session = useSession();
  const organization =
    session.kind === 'member' ? session.organization : undefined;
  const query = useCampaignQuery(organization?.id, organization !== undefined);
  const list = classifyList(session, query);
  const hadAccess = useHadAccess(organization?.id, list.kind === 'ready');
  return {
    list: list.kind === 'no_access' ? { ...list, hadAccess } : list,
    retry: () => {
      void query.refetch();
    },
  };
}

export type CampaignHomeSelection = HomeSelection & {
  create: CreateCampaign;
  /** A concise outcome for the live region, e.g. after a create. */
  announcement: string | null;
  startCreate: () => void;
  cancelCreate: () => void;
  /** Call when an existing row is chosen: leaves the local create form. */
  choose: () => void;
};

// Local create and selection state for one organization. Mount it keyed by
// the organization so none of it, and no late create result, carries into
// another organization.
export function useCampaignHomeSelection({
  organization,
  campaigns,
  requested,
}: {
  organization: Organization;
  campaigns: Doc<'campaign'>[];
  requested: string | null;
}): CampaignHomeSelection {
  const guard = useNavigationGuard();
  const [creating, setCreating] = useState(false);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  // Read when a create is acknowledged, which may be after the player has
  // left the form (the new campaign is then listed but not selected) or
  // after this organization's screen is gone (nothing happens). Written only
  // in event handlers and the unmount cleanup.
  const inCreateForm = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const showCreateForm = (value: boolean) => {
    inCreateForm.current = value;
    setCreating(value);
  };

  const request = useCreateCampaign({ organizationId: organization.id });
  const create: CreateCampaign = {
    status: request.status,
    submit: async (values) => {
      const from = requested;
      const campaignId = await request.submit(values);
      if (campaignId === null) return false;
      if (!mounted.current) return true;
      setAnnouncement(`Created ${values.name}.`);
      if (inCreateForm.current) {
        showCreateForm(false);
        setOpening({ campaignId, name: values.name, from });
        guard.navigate(campaignPath(campaignId));
      }
      return true;
    },
  };

  const selection = resolveSelection({
    campaigns,
    organization,
    requested,
    creating,
    opening,
  });
  // Adjust during render once the new home is shown or the player moved on.
  if (selection.openingSettled) setOpening(null);

  return {
    ...selection,
    create,
    announcement,
    startCreate: () => {
      setAnnouncement(null);
      showCreateForm(true);
    },
    cancelCreate: () => showCreateForm(false),
    choose: () => {
      showCreateForm(false);
      setOpening(null);
    },
  };
}
