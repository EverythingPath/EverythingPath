import type { FunctionReturnType } from 'convex/server';
import type { api } from '@convex/_generated/api';
import type { Doc } from '@convex/_generated/dataModel';
import type {
  Organization,
  Session,
} from '~/components/campaign-shell/session';

export type { Organization };
type Campaign = Doc<'campaign'>;

type CampaignList = FunctionReturnType<typeof api.campaign.getCampaigns>;

export type HomeList =
  | { kind: 'resolving' }
  | { kind: 'unreachable' }
  | { kind: 'signed_out' }
  | { kind: 'no_organization' }
  | {
      kind: 'no_access';
      organization: Organization;
      /** This session saw the member's access, so it was lost (#710). */
      hadAccess?: boolean;
    }
  | { kind: 'failed'; organization: Organization }
  | { kind: 'ready'; organization: Organization; campaigns: Campaign[] };

// The list is read only for a settled member session. A failed read is never
// an empty organization, and "no access" is distinct from choosing none.
export function classifyList(
  session: Session,
  query: { data?: CampaignList; error?: unknown },
): HomeList {
  if (session.kind !== 'member') return session;
  const { organization } = session;
  if (query.error) return { kind: 'failed', organization };
  if (!query.data) return { kind: 'resolving' };
  switch (query.data.state) {
    case 'no_org_selected':
      return { kind: 'no_organization' };
    case 'no_access':
      return { kind: 'no_access', organization };
    case 'ready':
      return { kind: 'ready', organization, campaigns: query.data.campaigns };
  }
}

/** A campaign this device just created, until its home is shown. */
export type Opening = {
  campaignId: string;
  name: string;
  /** The selection in the address when the create request was sent. */
  from: string | null;
};

export type HomePane =
  | { kind: 'campaign'; campaign: Campaign }
  | { kind: 'opening'; name: string }
  | { kind: 'unavailable'; organization: Organization }
  | { kind: 'create'; entry: 'new' | 'empty' };

export type HomeSelection = {
  pane: HomePane;
  /** The existing row shown as selected, if any. */
  selectedId: string | null;
  /** The local row for a new or just-created campaign. */
  ghost: { kind: 'new' } | { kind: 'opening'; name: string } | null;
  /** The just-created campaign's home is shown (or the player moved on). */
  openingSettled: boolean;
};

// `requested` is the id in the address (null on the bare list). An explicit
// id is never replaced by another campaign: absent from the authorized list
// it is unavailable, unless it is the campaign this device just created and
// the list has not observed yet. Names are never matched.
export function resolveSelection({
  campaigns,
  organization,
  requested,
  creating,
  opening,
}: {
  campaigns: Campaign[];
  organization: Organization;
  requested: string | null;
  creating: boolean;
  opening: Opening | null;
}): HomeSelection {
  const found = requested
    ? campaigns.find((campaign) => campaign._id === requested)
    : undefined;
  const waiting =
    opening !== null &&
    (requested === opening.from ||
      (requested === opening.campaignId && !found));
  const openingSettled = opening !== null && !waiting;
  if (creating)
    return {
      pane: { kind: 'create', entry: 'new' },
      selectedId: null,
      ghost: { kind: 'new' },
      openingSettled,
    };
  if (waiting)
    return {
      pane: { kind: 'opening', name: opening.name },
      selectedId: null,
      ghost: { kind: 'opening', name: opening.name },
      openingSettled,
    };
  const campaign = requested ? found : campaigns[0];
  if (campaign)
    return {
      pane: { kind: 'campaign', campaign },
      selectedId: campaign._id,
      ghost: null,
      openingSettled,
    };
  return {
    pane: requested
      ? { kind: 'unavailable', organization }
      : { kind: 'create', entry: 'empty' },
    selectedId: null,
    ghost: null,
    openingSettled,
  };
}
