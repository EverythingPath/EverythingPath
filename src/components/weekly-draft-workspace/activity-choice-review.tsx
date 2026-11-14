'use client';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { ActivityBoard } from './use-activity-board';
import { reviewRequirementMessage } from './summary-messages';
import type { ActivityView } from './types';

type Slot = ActivityView['slots'][number];
type ReviewState = { choiceId: string; kind: 'pending' | 'failed' } | null;

/** The recorded Character this choice names, when it's no longer here. */
function isCharacterDeparted(slot: Slot, view: ActivityView) {
  const choice = slot.choice;
  if (!choice || !('characterId' in choice) || !choice.characterId)
    return false;
  return !view.characters.some(
    (character) => character.characterId === choice.characterId,
  );
}

/**
 * A choice a departed Character flagged for review. Its detail, rolls and
 * modifiers are kept; Review choice saves the current choice unchanged, which
 * clears the flag once saved. A choice that still names the departed
 * Character can't be saved as it is: its editor below replaces the
 * Character, or Clear removes the choice. The flag stays until the saved
 * Activity no longer carries it, and a failed save keeps it with the reason.
 */
export function ActivityChoiceReview({
  slot,
  view,
  reviewChoice,
  disabled,
}: {
  slot: Slot;
  view: ActivityView;
  reviewChoice: ActivityBoard['reviewChoice'];
  disabled: boolean;
}) {
  const [state, setState] = useState<ReviewState>(null);
  const choice = slot.choice;
  if (!choice?.reviewRequired) return null;
  const local = state?.choiceId === choice.choiceId ? state.kind : null;
  const isDeparted = isCharacterDeparted(slot, view);
  async function review() {
    const current = slot.choice;
    if (!current || disabled || local === 'pending') return;
    setState({ choiceId: current.choiceId, kind: 'pending' });
    const result = await reviewChoice(slot.slotId);
    setState(
      result === 'accepted'
        ? null
        : { choiceId: current.choiceId, kind: 'failed' },
    );
  }
  return (
    <div
      role="group"
      aria-label="Choice review"
      className="space-y-2 border border-amber-300/50 p-3"
    >
      <p className="flex gap-1.5 text-sm text-amber-300">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {reviewRequirementMessage}
        </span>
      </p>
      {isDeparted ? (
        <p className="text-muted-foreground text-sm">
          This choice names a character who is no longer here. Choose another
          character below, or clear {slot.actionName ?? 'the choice'}.
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 md:min-h-9"
          disabled={disabled || local === 'pending'}
          onClick={() => void review()}
        >
          Review choice
        </Button>
      )}
      <p
        role="status"
        className={cn(
          'text-muted-foreground text-xs',
          local !== 'pending' && 'sr-only',
        )}
      >
        {local === 'pending' ? 'Saving review…' : ''}
      </p>
      {local === 'failed' ? (
        <p role="alert" className="text-destructive text-xs">
          This review wasn’t saved. Try again.
        </p>
      ) : null}
    </div>
  );
}
