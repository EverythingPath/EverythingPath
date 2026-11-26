'use client';

import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { useMemo } from 'react';
import type { CharacterSheetSnapshot } from './use-character-sheet';

export function useCompanionCandidates(
  snapshot: CharacterSheetSnapshot | null | undefined,
  isNeeded: boolean,
) {
  const campaignCandidates = useQuery(
    api.character.listCampaignCharacters,
    isNeeded && snapshot?.campaign
      ? {
          campaignId: snapshot.campaign.campaignId,
          organizationId: snapshot.campaign.organizationId,
        }
      : 'skip',
  );
  const owned = useQuery(
    api.character.listOwned,
    isNeeded && snapshot && !snapshot.campaign ? {} : 'skip',
  );
  const candidates = useMemo(() => {
    const characters = snapshot?.campaign
      ? campaignCandidates?.map(({ character }) => character)
      : owned
          ?.filter((group) => group.kind === 'noCampaign')
          .flatMap((group) => group.characters);
    return characters
      ?.filter(
        (character) =>
          character.sheetMode !== undefined &&
          character._id !== snapshot?.character._id &&
          (snapshot?.campaign
            ? character.campaignId === snapshot.character.campaignId
            : !character.campaignId &&
              character.ownerId === snapshot?.character.ownerId),
      )
      .map((character) => ({
        characterId: character._id,
        name: character.name,
      }));
  }, [snapshot, campaignCandidates, owned]);
  return {
    candidates,
    isCandidatesLoading: isNeeded && candidates === undefined,
  };
}
