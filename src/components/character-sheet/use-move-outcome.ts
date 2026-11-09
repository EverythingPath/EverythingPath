'use client';
import type {
  CharacterMoveProgress,
  useCharacterMove,
} from './use-character-move';
import { useWatchedMove, type WatchedMove } from './use-watched-move';

type Movement = ReturnType<typeof useCharacterMove>;

export type MoveOutcome =
  | 'moved'
  | 'added'
  | 'left'
  | 'cancelled'
  | NonNullable<CharacterMoveProgress['cancelReason']>
  | null;

/**
 * What a move that this control watched ended as. The status read keeps a
 * Character's latest move, so a move finished before the control opened says
 * nothing; one seen unfinished here reports its completion or cancellation.
 * A move stopped by something other than the player's cancel names why, so
 * only the requester reads it: other members and a new owner never watched
 * it. A move this device watched that another device's newer move replaced
 * is reported as replaced while the newer move is followed. A waiting move
 * hasn't ended, so the progress panel shows it. The Character's campaign
 * stays authoritative until the move is published, so the campaign seen
 * while it was pending tells a move from a join. A newer refusal always wins
 * over an earlier success.
 */
export function useMoveOutcome(movement: Movement): MoveOutcome {
  const { progress } = movement;
  const watched = useWatchedMove(
    progress,
    movement.currentCampaignId !== undefined,
  );
  if (movement.status.kind === 'error' || movement.isBusy) return null;
  const outcome =
    progress && watched ? finishedOutcome(progress, watched, movement) : null;
  return outcome ?? (movement.replacedMove ? 'replaced' : null);
}

function finishedOutcome(
  progress: CharacterMoveProgress,
  watched: WatchedMove,
  movement: Movement,
): MoveOutcome {
  if (progress.state === 'cancelled')
    return progress.cancelReason ?? 'cancelled';
  if (progress.state !== 'completed') return null;
  if (movement.currentCampaignId === undefined) return 'left';
  return watched.hadCampaign ? 'moved' : 'added';
}

export const moveOutcomeText: Record<Exclude<MoveOutcome, null>, string> = {
  moved: 'Character moved.',
  added: 'Added to campaign.',
  left: 'Left campaign.',
  cancelled: 'Move cancelled. Your character stays in its current campaign.',
  ownershipChanged:
    'This character’s owner changed while the move was being prepared, so nothing moved. Start the move again if you still want it.',
  campaignChanged:
    'This character’s campaign changed while the move was being prepared, so nothing moved.',
  groupChanged:
    'The Characters moving together changed while the move was being prepared, so nothing moved. Review the Companions and start again.',
  replaced:
    'Another move for this character replaced this one. Your character stays in its current campaign until that move completes.',
};

/** Joining or moving never puts the Character on a militia roster. */
export const rosterNote =
  'Add this character to the militia roster separately.';
