'use client';
import type { CharacterOwner } from '~/lib/character-ownership';
import type { Doc } from '@convex/_generated/dataModel';
import { ArchiveControl } from './archive-control';
import { CharacterMoveControl } from './character-move-control';
import { useCharacterOwnership } from './use-character-ownership';
import { CharacterOwnerControl } from './character-owner-control';
import type { CharacterScope } from './character-scope';
import { DeleteCharacterControl } from './delete-character-control';
import {
  useCharacterLifecycle,
  type Deletion,
} from './use-character-lifecycle';
import { useCharacterMove } from './use-character-move';

// The owner's campaign membership actions, read by Character identity only:
// the route's campaign and organization never grant a move.
function MembershipActions({
  character,
  campaignName,
}: {
  character: Doc<'character'>;
  campaignName?: string;
}) {
  const movement = useCharacterMove({ characterId: character._id });
  return (
    <CharacterMoveControl
      characterName={character.name}
      campaignName={campaignName}
      isMilitiaOnly={character.sheetMode === 'militiaOnly'}
      movement={movement}
    />
  );
}

/**
 * What a Character's campaign row offers: a campaign Character names its
 * owner, reassignable to any current member, and is archived or restored;
 * a private one is deleted. A private sheet is readable only by its owner,
 * so whoever sees it may delete it; the server still decides. The owner
 * control reads the persisted campaign, so an independent campaign sheet
 * offers it without a selected organization. The owner's Add, Move and
 * Leave campaign come first, once, in the page body.
 */
export function CharacterLifecycle({
  character,
  campaignName,
  owner,
  organizationId,
  campaignId,
  ownershipAvailable,
  onDeletion,
}: Omit<CharacterScope, 'characterId'> & {
  character: Doc<'character'>;
  /** The current campaign's name from the authorized sheet read. */
  campaignName?: string;
  owner: CharacterOwner | null;
  ownershipAvailable: boolean;
  onDeletion: (deletion: Deletion) => void;
}) {
  const lifecycle = useCharacterLifecycle({
    organizationId,
    campaignId,
    characterId: character._id,
    characterName: character.name,
    onDeletion,
  });
  const ownership = useCharacterOwnership(
    {
      characterId: character._id,
      campaignId: character.campaignId,
      organizationId,
    },
    owner,
    character.ownerLastOperationId,
    ownershipAvailable,
  );
  const membership = (
    <MembershipActions
      key={character._id}
      character={character}
      campaignName={campaignName}
    />
  );
  if (!character.campaignId)
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        {membership}
        <DeleteCharacterControl name={character.name} lifecycle={lifecycle} />
      </div>
    );
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
      {membership}
      <CharacterOwnerControl
        characterName={character.name}
        ownership={ownership}
      />
      <ArchiveControl character={character} lifecycle={lifecycle} />
    </div>
  );
}
