'use client';
import { ArrowRightLeft, LogOut, UserPlus } from 'lucide-react';
import { useId, useState } from 'react';
import { CharacterLeaveDialog } from './character-leave-dialog';
import { departureNote, movingCompanionCount } from './character-move-copy';
import { Button } from '~/components/ui/button';
import { Dialog, DialogTrigger } from '~/components/ui/dialog';
import { MoveFeedback } from './character-move-feedback';
import { MoveLoading } from './character-move-loading';
import { MoveReadError } from './character-move-read-error';
import { CharacterMovePicker } from './character-move-picker';
import { MoveGroupPreview } from './character-move-group';
import { MoveProgress } from './character-move-progress';
import { action } from './sheet-parts';
import type { useCharacterMove } from './use-character-move';
import { useMovePhaseFocus } from './use-keep-move-focus';
import { useMoveOutcome } from './use-move-outcome';

/**
 * The owner's way into, out of and between campaigns, in the sheet's campaign
 * row (approved variant B's membership strip). No campaign offers Add to
 * campaign; a campaign offers Move to campaign and Leave campaign with what
 * leaving takes away. Nothing is offered until ownership and eligibility are
 * read, and nothing to anyone else. A started move shows its progress until
 * it is complete or cancelled; refusals and uncertain replies stay beside it.
 * The host keys this on the Character, so another Character starts afresh.
 */
export function CharacterMoveControl({
  characterName,
  campaignName,
  isMilitiaOnly = false,
  movement,
}: {
  characterName: string;
  campaignName?: string;
  /** A departure makes a Militia-only Character Full, for good. */
  isMilitiaOnly?: boolean;
  movement: ReturnType<typeof useCharacterMove>;
}) {
  const leaveNoteId = useId();
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const outcome = useMoveOutcome(movement);
  const { isPending, focus } = useMovePhaseFocus(movement);
  if (movement.readError)
    return (
      <div className="flex max-w-md min-w-0 flex-col gap-1.5">
        <MoveReadError movement={movement} />
      </div>
    );
  if (movement.isLoading) return <MoveLoading movement={movement} />;
  if (!movement.isAvailable) return null;
  const isInCampaign = movement.currentCampaignId !== undefined;
  const companions = movingCompanionCount(movement.groupPreview);
  return (
    <div
      {...focus}
      className="flex max-w-md min-w-0 flex-col gap-1.5 outline-none"
    >
      {isPending ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <Dialog
            open={movement.isPickerOpen}
            onOpenChange={movement.setIsPickerOpen}
          >
            <DialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={action}
                disabled={!movement.canReviewMove}
              >
                {isInCampaign ? (
                  <>
                    <ArrowRightLeft aria-hidden /> Move to campaign
                  </>
                ) : (
                  <>
                    <UserPlus aria-hidden /> Add to campaign
                  </>
                )}
              </Button>
            </DialogTrigger>
            {movement.isPickerOpen ? (
              <CharacterMovePicker
                characterName={characterName}
                campaignName={campaignName}
                isMilitiaOnly={isMilitiaOnly}
                movement={movement}
                onCloseAutoFocus={(event) => {
                  // A started move replaces the trigger with its progress.
                  const root = focus.ref.current;
                  if (!root || root.querySelector('[aria-haspopup="dialog"]'))
                    return;
                  event.preventDefault();
                  (
                    root.querySelector<HTMLElement>('button:not(:disabled)') ??
                    root
                  ).focus();
                }}
              />
            ) : null}
          </Dialog>
          {isInCampaign ? (
            <Dialog open={isLeaveOpen} onOpenChange={setIsLeaveOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={action}
                  disabled={!movement.canReviewMove}
                  aria-describedby={leaveNoteId}
                >
                  <LogOut aria-hidden /> Leave campaign
                </Button>
              </DialogTrigger>
              {isLeaveOpen ? (
                <CharacterLeaveDialog
                  characterName={characterName}
                  campaignName={campaignName}
                  isMilitiaOnly={isMilitiaOnly}
                  movement={movement}
                  onStay={() => setIsLeaveOpen(false)}
                  onLeave={() => {
                    void movement.startMove().then((saved) => {
                      if (saved) setIsLeaveOpen(false);
                    });
                  }}
                  onCloseAutoFocus={(event) => {
                    const root = focus.ref.current;
                    if (!root || root.querySelector('[aria-haspopup="dialog"]'))
                      return;
                    event.preventDefault();
                    (
                      root.querySelector<HTMLElement>(
                        'button:not(:disabled)',
                      ) ?? root
                    ).focus();
                  }}
                />
              ) : null}
            </Dialog>
          ) : null}
        </div>
      )}
      {isInCampaign && !isPending ? (
        <p id={leaveNoteId} className="text-muted-foreground text-xs">
          {departureNote(isMilitiaOnly, companions)}
        </p>
      ) : null}
      {movement.groupPreview?.refusal &&
      !movement.isPickerOpen &&
      !isLeaveOpen ? (
        <MoveGroupPreview movement={movement} />
      ) : null}
      <MoveProgress movement={movement} isMilitiaOnly={isMilitiaOnly} />
      {movement.isPickerOpen ? null : (
        <MoveFeedback movement={movement} outcome={outcome} />
      )}
    </div>
  );
}
