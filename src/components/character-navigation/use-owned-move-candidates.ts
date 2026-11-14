'use client';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useConvexAuth, useQuery } from 'convex/react';
import { formatCharacterKind } from '~/lib/character-kind';

export type MoveCandidate = {
  id: Id<'character'>;
  name: string;
  level: number;
  kind: string;
  /** The campaign it moves from; null for No campaign. */
  fromCampaignName: string | null;
  isMilitiaOnly: boolean;
};

/**
 * The player's accessible owned Characters that could come to this campaign:
 * No campaign first, then those in other campaigns, each once. Characters
 * already here are left out. Undefined while loading.
 */
export function useOwnedMoveCandidates(
  campaignId: Id<'campaign'>,
): MoveCandidate[] | undefined {
  const auth = useConvexAuth();
  const groups = useQuery(
    api.character.listOwned,
    auth.isAuthenticated ? {} : 'skip',
  );
  return groups?.flatMap((group) =>
    group.kind === 'campaign' && group.campaignId === campaignId
      ? []
      : group.characters.map((character) => ({
          id: character._id,
          name: character.name,
          level: character.level,
          kind: formatCharacterKind(character.kind),
          fromCampaignName:
            group.kind === 'campaign' ? group.campaignName : null,
          isMilitiaOnly: character.sheetMode === 'militiaOnly',
        })),
  );
}
