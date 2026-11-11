'use client';

import { api } from '@convex/_generated/api';
import type { CampaignScope } from '~/lib/campaign-scope';
import type { Doc } from '@convex/_generated/dataModel';
import { useOrganization } from '@clerk/nextjs';
import { useConvexAuth, useQuery } from 'convex/react';
import { useOrganizationMemberships } from '~/components/campaign-shell/use-organization-memberships';
import { formatCharacterKind } from '~/lib/character-kind';
import { needsOwner } from '~/lib/character-ownership';
import type {
  OwnedCharacterListRow,
  CampaignCharacterListRow,
  ReturningOrganization,
} from './character-list-model';
import {
  campaignPath,
  characterCreatePath,
  characterSheetPath,
  type CharacterSheetOrigin,
} from '~/lib/campaign-routes';

function buildCharacterListRow(
  character: Doc<'character'>,
): Omit<OwnedCharacterListRow, 'href'> {
  return {
    id: character._id,
    name: character.name,
    level: character.level,
    kind: formatCharacterKind(character.kind),
    active: character.isActive,
  };
}

export function useOwnedCharacters() {
  const auth = useConvexAuth();
  const user = useQuery(api.user.getMe, auth.isAuthenticated ? {} : 'skip');
  const data = useQuery(
    api.character.listOwned,
    auth.isAuthenticated ? {} : 'skip',
  );
  const departures = useQuery(
    api.organizationDepartures.listReturning,
    auth.isAuthenticated ? {} : 'skip',
  );
  const { organization } = useOrganization();
  const memberships = useOrganizationMemberships();
  const origin: CharacterSheetOrigin = {
    href: '/characters',
    organization: organization
      ? { kind: 'organization', id: organization.id }
      : { kind: 'personal' },
  };
  const organizationName = (organizationId: string) =>
    memberships.find(
      (membership) => membership.organization.id === organizationId,
    )?.organization.name;
  // Organizations the player left whose Characters are still on the way back.
  const returning: ReturningOrganization[] = (departures ?? []).map(
    ({ organizationId, setAside }) => ({
      organizationId,
      organizationName: organizationName(organizationId),
      setAside,
    }),
  );
  const groups = data?.map((group) => {
    const characters = group.characters.map((character) => ({
      ...buildCharacterListRow(character),
      href: characterSheetPath(character._id, origin),
      companions: { characterId: character._id, origin },
    }));
    if (group.kind === 'noCampaign')
      return { key: 'noCampaign', title: 'No campaign', characters };
    return {
      key: group.campaignId,
      title: group.campaignName,
      characters,
      organizationName:
        organizationName(group.organizationId) ?? 'Organization',
    };
  });
  return {
    groups,
    returning,
    newHref: user?.characterSheetDemo
      ? characterCreatePath(
          undefined,
          organization
            ? { kind: 'organization', id: organization.id }
            : { kind: 'personal' },
        )
      : undefined,
  };
}

export function useCampaignCharacters({
  campaignId,
  organizationId,
}: CampaignScope) {
  const data = useQuery(api.character.listCampaignCharacters, {
    campaignId,
    organizationId,
  });
  const campaigns = useQuery(api.campaign.getCampaigns, { organizationId });
  const contexts = useQuery(api.campaign.listNavigationContexts, {
    organizationId,
  });
  const hasMilitia = contexts?.find(
    (context) => context.campaignId === campaignId,
  )?.hasMilitia;
  const campaign =
    campaigns?.state === 'ready'
      ? campaigns.campaigns.find((item) => item._id === campaignId)
      : undefined;
  const origin: CharacterSheetOrigin = {
    href: campaignPath(campaignId, 'characters'),
    organization: { kind: 'organization', id: organizationId },
  };
  const ownershipAvailable = Boolean(campaign?.e2eFixture);
  return {
    characters: data?.map(
      ({ character, ownerName, owner, ownerDeparted, isOnRoster }) =>
        ({
          ...buildCharacterListRow(character),
          href: character.sheetMode
            ? characterSheetPath(character._id, origin)
            : hasMilitia
              ? campaignPath(campaignId, 'officers')
              : undefined,
          companions: character.sheetMode
            ? { characterId: character._id, origin }
            : undefined,
          id: character._id,
          ownerName,
          owner,
          ownerDeparted,
          needsOwner: needsOwner({ owner, ownershipAvailable }),
          ownershipAvailable,
          ownerLastOperationId: character.ownerLastOperationId,
          isOnRoster,
        }) satisfies CampaignCharacterListRow,
    ),
    newHref: campaign?.e2eFixture
      ? characterCreatePath(campaignId, {
          kind: 'organization',
          id: organizationId,
        })
      : undefined,
  };
}
