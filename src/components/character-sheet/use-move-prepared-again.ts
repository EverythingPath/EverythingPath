'use client';
import { isMovePreparingOrReady } from './character-move-state';
import type { CharacterMoveProgress } from './use-character-move';
import { useWatchedMove } from './use-watched-move';

/**
 * Whether a move watched here went back to preparing because edits changed
 * what it must carry, such as new homebrew or a campaign Spell list change.
 * A move first seen part-way through such a restart says nothing: the note
 * belongs with the preparation this control saw restart, and goes when the
 * move completes or stops.
 */
export function useMovePreparedAgain(progress: CharacterMoveProgress | null) {
  const watched = useWatchedMove(progress);
  return (
    isMovePreparingOrReady(progress) &&
    watched !== null &&
    progress.generation > watched.generation
  );
}
