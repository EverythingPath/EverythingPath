'use client';
import type { useCharacterMove } from './use-character-move';
type Movement = ReturnType<typeof useCharacterMove>;

/** While the control's own reads are pending, nothing is offered yet. */
export function MoveLoading({ movement }: { movement: Movement }) {
  return (
    <p role="status" className="text-muted-foreground text-xs">
      {movement.isAvailable
        ? 'Loading move progress…'
        : 'Loading campaign choices…'}
    </p>
  );
}
