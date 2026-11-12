'use client';
import { useState } from 'react';
import { isMoveUnfinished } from './character-move-state';
import type { CharacterMoveProgress } from './use-character-move';

export type WatchedMove = {
  operationId: string;
  /** The preparation generation first seen. */
  generation: number;
  /** Whether the Character had a campaign when the move was first seen. */
  hadCampaign: boolean;
};

/**
 * The first view of the move this control saw unfinished. A move's result
 * and its restarts belong to the control that watched it, so a move that
 * ended before the control opened, or a newer move, has no watched view.
 */
export function useWatchedMove(
  progress: CharacterMoveProgress | null,
  hasCampaign = false,
): WatchedMove | null {
  const [watched, setWatched] = useState<WatchedMove | null>(null);
  if (
    isMoveUnfinished(progress) &&
    watched?.operationId !== progress.operationId
  ) {
    const next = {
      operationId: progress.operationId,
      generation: progress.generation,
      hadCampaign: hasCampaign,
    };
    setWatched(next);
    return next;
  }
  return watched && watched.operationId === progress?.operationId
    ? watched
    : null;
}
