'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useCharacterMove } from '~/components/character-sheet/use-character-move';
import { campaignPath, characterSheetPath } from '~/lib/campaign-routes';
import { CharacterArrivalControl } from './character-arrival-control';
import type { MoveCandidate } from './use-owned-move-candidates';

// The chosen Character's own movement controller, bound to this campaign as
// its destination. The dialog keys it on the Character, so changing the
// choice starts a fresh controller and an older reply can't reach it.
export function CharacterArrival({
  candidate,
  campaignId,
  campaignName,
  organizationId,
}: {
  candidate: MoveCandidate;
  campaignId: Id<'campaign'>;
  campaignName: string;
  organizationId: string;
}) {
  const movement = useCharacterMove({ characterId: candidate.id });
  return (
    <CharacterArrivalControl
      characterName={candidate.name}
      fromCampaignName={candidate.fromCampaignName}
      isMilitiaOnly={candidate.isMilitiaOnly}
      destination={{ campaignId, campaignName }}
      sheetHref={characterSheetPath(candidate.id, {
        href: campaignPath(campaignId, 'characters'),
        organization: { kind: 'organization', id: organizationId },
      })}
      movement={movement}
    />
  );
}
