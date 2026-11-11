'use client';
import { ArrowRight, Check, Search, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { action, fieldLabel } from './sheet-parts';
import type { useCharacterMove } from './use-character-move';
import {
  departureText,
  groupDepartureText,
  moveGroupSize,
  privateDepartureNote,
} from './character-move-copy';
import {
  isMoveUnfinished,
  isMoveWaitingForAccess,
} from './character-move-state';
import { useMovePreparedAgain } from './use-move-prepared-again';

type Movement = ReturnType<typeof useCharacterMove>;

function ProgressBar({ prepared, total }: { prepared: number; total: number }) {
  const done = Math.min(prepared, total);
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label="Homebrew preserved"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total}`}
        className="bg-foreground/10 h-1.5 min-w-0 flex-1 overflow-hidden"
      >
        <div
          className="bg-primary h-full transition-[width] motion-reduce:transition-none"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
      <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
        {done} of {total}
      </span>
    </div>
  );
}

type UnfinishedProgress = NonNullable<Movement['progress']> & {
  state: 'preparing' | 'ready' | 'waiting';
};

function headline(progress: UnfinishedProgress, groupSize: number) {
  if (progress.state === 'waiting')
    return `Waiting for access to ${progress.destinationCampaignName ?? 'the destination campaign'}…`;
  if (progress.state === 'ready') return 'Ready to move';
  return groupSize > 1
    ? `Preserving homebrew for ${groupSize} Characters…`
    : 'Preserving homebrew…';
}

// A group moves as one: no member arrives before the rest, so every member
// is still in its current campaign until the whole move completes.
function detail(progress: UnfinishedProgress, groupSize: number) {
  if (progress.state === 'waiting')
    return groupSize > 1
      ? `The move continues when access returns. All ${groupSize} Characters stay in their current campaigns.`
      : 'The move continues when access returns. Your character stays in its current campaign.';
  if (progress.state === 'ready')
    return groupSize > 1
      ? `Nothing changes until you complete the move; all ${groupSize} Characters move together.`
      : 'Nothing changes until you complete the move.';
  return groupSize > 1
    ? `All ${groupSize} Characters stay in their current campaigns until the move completes together.`
    : 'Your character stays in its current campaign until the move completes.';
}

function preparedAgainText(isReady: boolean, groupSize: number) {
  const included =
    groupSize > 1
      ? 'Recent changes to these Characters are included.'
      : 'Recent changes to this character are included.';
  return isReady ? included : `${included} Preparing again.`;
}

/**
 * A saved move that isn't finished: preserving homebrew in bounded steps,
 * ready to publish, waiting for destination access, or a lost reply to
 * check. The Character, its campaign and the old roster stay as they are
 * until Complete move is saved, so nothing here reads as moved. A group
 * (#711) is counted as one: its preparation is summed, and no member is
 * ever said to have arrived before the rest. Edits that
 * change what the move must carry restart its preparation with a quiet note.
 * A waiting move continues once access returns, or can be cancelled. Check
 * progress inspects the recorded move rather than starting another.
 */
export function MoveProgress({
  movement,
  isMilitiaOnly = false,
}: {
  movement: Movement;
  isMilitiaOnly?: boolean;
}) {
  const { progress } = movement;
  const isPreparedAgain = useMovePreparedAgain(progress);
  if (movement.needsInspection)
    return (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className={action}
          disabled={!movement.canResume}
          onClick={() => void movement.resumeMove()}
        >
          <Search aria-hidden /> Check progress
        </Button>
      </div>
    );
  if (!isMoveUnfinished(progress)) return null;
  const isWaiting = isMoveWaitingForAccess(progress);
  const isReady = progress.state === 'ready';
  const groupSize = moveGroupSize(progress);
  return (
    <section
      aria-label="Move progress"
      className="border-foreground/15 bg-card flex w-full flex-col gap-2 border p-2"
    >
      <div className="flex flex-col gap-0.5">
        <p
          role={isWaiting ? 'status' : undefined}
          className="flex flex-wrap items-baseline gap-x-2 text-sm"
        >
          <span className={fieldLabel}>Move</span>
          <span>{headline(progress, groupSize)}</span>
        </p>
        <p className="text-muted-foreground text-xs">
          {detail(progress, groupSize)}
        </p>
        {isWaiting ? null : (
          <p
            role="status"
            className={
              isPreparedAgain ? 'text-muted-foreground text-xs' : 'sr-only'
            }
          >
            {isPreparedAgain ? preparedAgainText(isReady, groupSize) : null}
          </p>
        )}
      </div>
      {progress.state === 'preparing' && progress.total > 0 ? (
        <ProgressBar prepared={progress.prepared} total={progress.total} />
      ) : null}
      {isReady &&
      movement.currentCampaignId &&
      !(
        movement.pendingDestinationCampaignId ?? progress.destinationCampaignId
      ) ? (
        <p className="text-muted-foreground text-xs">
          {departureText(isMilitiaOnly, movement.departureRoles)}{' '}
          {groupSize > 1 ? `${groupDepartureText(groupSize - 1)} ` : ''}
          {privateDepartureNote(groupSize - 1)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {isWaiting ? null : (
          <Button
            type="button"
            size="sm"
            className={action}
            disabled={!movement.canResume}
            onClick={() => void movement.resumeMove()}
          >
            {isReady ? (
              <>
                <Check aria-hidden /> Complete move
              </>
            ) : (
              <>
                <ArrowRight aria-hidden /> Continue move
              </>
            )}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={action}
          disabled={!movement.canCancel}
          onClick={() => void movement.cancelMove()}
        >
          <X aria-hidden /> Cancel move
        </Button>
      </div>
    </section>
  );
}
