import type { CharacterMoveProgress } from './use-character-move';

export function isMovePreparingOrReady(
  progress: CharacterMoveProgress | null,
): progress is CharacterMoveProgress & { state: 'preparing' | 'ready' } {
  return progress?.state === 'preparing' || progress?.state === 'ready';
}

/** A move that hasn't completed or been cancelled, including one waiting. */
export function isMoveUnfinished(
  progress: CharacterMoveProgress | null,
): progress is CharacterMoveProgress & {
  state: 'preparing' | 'ready' | 'waiting';
} {
  return isMovePreparingOrReady(progress) || progress?.state === 'waiting';
}

/**
 * A move whose destination the owner can't reach right now. Nothing is
 * undone: it continues when access returns, or the owner cancels it.
 */
export function isMoveWaitingForAccess(
  progress: CharacterMoveProgress | null,
): progress is CharacterMoveProgress & { state: 'waiting' } {
  return progress?.state === 'waiting';
}
