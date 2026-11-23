'use client';
import { RotateCw } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { action } from './sheet-parts';
import type { useCharacterMove } from './use-character-move';
type Movement = ReturnType<typeof useCharacterMove>;

/** Campaign choices or progress couldn't be read; nothing moves until they are. */
export function MoveReadError({ movement }: { movement: Movement }) {
  if (!movement.readError) return null;
  return (
    <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
      <p
        role="alert"
        className="text-destructive min-w-0 text-xs [overflow-wrap:anywhere]"
      >
        {movement.readError}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={action}
        onClick={() => void movement.retryRead()}
      >
        <RotateCw aria-hidden /> Try again
      </Button>
    </div>
  );
}
