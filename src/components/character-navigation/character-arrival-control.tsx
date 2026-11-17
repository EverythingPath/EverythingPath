'use client';
import type { Id } from '@convex/_generated/dataModel';
import { ArrowRightLeft, ChevronRight, UserPlus } from 'lucide-react';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { MoveFeedback } from '~/components/character-sheet/character-move-feedback';
import { MoveLoading } from '~/components/character-sheet/character-move-loading';
import { MoveReadError } from '~/components/character-sheet/character-move-read-error';
import {
  arrivalSentence,
  departureSentence,
  movingCompanionCount,
} from '~/components/character-sheet/character-move-copy';
import { MoveGroupPreview } from '~/components/character-sheet/character-move-group';
import { MoveProgress } from '~/components/character-sheet/character-move-progress';
import { action } from '~/components/character-sheet/sheet-parts';
import type { useCharacterMove } from '~/components/character-sheet/use-character-move';
import { useMovePhaseFocus } from '~/components/character-sheet/use-keep-move-focus';
import { useMoveOutcome } from '~/components/character-sheet/use-move-outcome';
import { Button } from '~/components/ui/button';

/**
 * One chosen Character's way into this campaign, with the sheet's movement
 * states: nothing is offered until its owner and eligibility are read, a
 * move already under way is continued rather than started again, and once
 * it arrives its independent sheet opens from here. Its active same-owner
 * Companions come with it (#711), named before the one action that moves
 * them all.
 */
export function CharacterArrivalControl({
  characterName,
  fromCampaignName,
  isMilitiaOnly,
  destination,
  sheetHref,
  movement,
}: {
  characterName: string;
  fromCampaignName: string | null;
  isMilitiaOnly: boolean;
  destination: { campaignId: Id<'campaign'>; campaignName: string };
  /** The Character's sheet with this campaign's Characters page as origin. */
  sheetHref: string;
  movement: ReturnType<typeof useCharacterMove>;
}) {
  const outcome = useMoveOutcome(movement);
  const { isPending, focus } = useMovePhaseFocus(movement);
  if (movement.readError) return <MoveReadError movement={movement} />;
  if (movement.isLoading) return <MoveLoading movement={movement} />;
  const pendingDestinationId =
    movement.pendingDestinationCampaignId ??
    movement.progress?.destinationCampaignId;
  if (isPending && pendingDestinationId !== destination.campaignId)
    return (
      <Button type="button" className={action} disabled>
        {pendingDestinationId
          ? `Moving to ${movement.progress?.destinationCampaignName ?? movement.destinations.find((item) => item.campaignId === pendingDestinationId)?.campaignName ?? 'another campaign'}`
          : 'Leaving campaign'}
      </Button>
    );
  const isHere = movement.currentCampaignId === destination.campaignId;
  const companions = movingCompanionCount(movement.groupPreview);
  const canJoin =
    movement.isAvailable &&
    movement.destinations.some(
      (choice) => choice.campaignId === destination.campaignId,
    );
  if (!isHere && !isPending && !canJoin)
    return (
      <p className="text-muted-foreground text-sm">
        {characterName} can’t be added to {destination.campaignName}.
      </p>
    );
  return (
    <div {...focus} className="flex min-w-0 flex-col gap-2 outline-none">
      {isPending ? (
        <p className="text-muted-foreground text-sm">
          {characterName} already has a move under way. Continue it, or cancel
          it to choose again.
        </p>
      ) : isHere ? (
        <GuardedLink
          href={sheetHref}
          className="hover:bg-foreground/5 focus-visible:ring-ring/50 flex min-h-11 items-center gap-2 px-1 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-inset md:min-h-9"
        >
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            Open {characterName}’s sheet
          </span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </GuardedLink>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {fromCampaignName
              ? departureSentence({
                  characterName,
                  campaignName: fromCampaignName,
                  isMilitiaOnly,
                  companions,
                })
              : arrivalSentence(
                  characterName,
                  destination.campaignName,
                  companions,
                )}
          </p>
          <MoveGroupPreview movement={movement} />
          <Button
            type="button"
            className={`${action} self-start`}
            disabled={!movement.canStart}
            onClick={() => void movement.startMove(destination.campaignId)}
          >
            {fromCampaignName ? (
              <>
                <ArrowRightLeft aria-hidden /> Move character
              </>
            ) : (
              <>
                <UserPlus aria-hidden /> Join campaign
              </>
            )}
          </Button>
        </>
      )}
      <MoveProgress movement={movement} />
      <MoveFeedback movement={movement} outcome={outcome} />
    </div>
  );
}
