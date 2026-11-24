'use client';
import { useState } from 'react';
import { moveGroupSize } from './character-move-copy';
import { RemoteNotice, SaveFeedback } from './sheet-parts';
import type { useCharacterMove } from './use-character-move';
import {
  moveOutcomeText,
  rosterNote,
  type MoveOutcome,
} from './use-move-outcome';

type Movement = ReturnType<typeof useCharacterMove>;

/** A finished group's result counts every member; none arrived earlier (#711). */
function outcomeText(outcome: Exclude<MoveOutcome, null>, groupSize: number) {
  if (groupSize <= 1) return moveOutcomeText[outcome];
  switch (outcome) {
    case 'moved':
      return `${groupSize} Characters moved together.`;
    case 'added':
      return `${groupSize} Characters added to campaign.`;
    case 'left':
      return `${groupSize} Characters left campaign.`;
    default:
      return moveOutcomeText[outcome];
  }
}

const groupRosterNote = 'Add them to the militia roster separately.';

/** A Character the owner kept when they left its campaign's organization. */
export const returnedText =
  'Returned to you when you left the organization. Campaign homebrew it used is now part of this character.';

/** The latest move was the return after the owner left the organization. */
function returnedOperationId(movement: Movement) {
  const { progress } = movement;
  return progress?.state === 'completed' &&
    progress.origin === 'organizationDeparture'
    ? progress.operationId
    : null;
}

/**
 * Saving, a watched move's result, or the refusal or uncertain reply verbatim,
 * beside the control that started it. A saved preparation is acknowledged by
 * the progress panel, never as a moved Character. A Character returned to its
 * owner when they left the organization says so once, until dismissed; the
 * move of theirs that the return replaced is never reported as a failure.
 */
export function MoveFeedback({
  movement,
  outcome,
}: {
  movement: Movement;
  outcome: MoveOutcome;
}) {
  const [dismissedReturn, setDismissedReturn] = useState<string | null>(null);
  const { status } = movement;
  const returned = returnedOperationId(movement);
  const shownOutcome = returned && outcome === 'replaced' ? null : outcome;
  const shown =
    status.kind === 'error' || status.kind === 'saving'
      ? status
      : shownOutcome
        ? ({ kind: 'saved' } as const)
        : ({ kind: 'idle' } as const);
  const groupSize = moveGroupSize(movement.progress);
  const savedText = shownOutcome
    ? movement.currentCampaignHasMilitia &&
      (shownOutcome === 'moved' || shownOutcome === 'added')
      ? `${outcomeText(shownOutcome, groupSize)} ${groupSize > 1 ? groupRosterNote : rosterNote}`
      : outcomeText(shownOutcome, groupSize)
    : '';
  return (
    <>
      <SaveFeedback
        status={shown}
        savedText={savedText}
        savingText="Saving move…"
        shouldHideWhenIdle
      />
      <RemoteNotice
        isShown={returned !== null && returned !== dismissedReturn}
        message={returnedText}
        subject="return"
        onDismiss={() => setDismissedReturn(returned)}
      />
    </>
  );
}
