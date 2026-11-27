'use client';
import { Button } from '~/components/ui/button';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { action, SaveFeedback } from './sheet-parts';
import type { useCharacterOwnership } from './use-character-ownership';

type Ownership = ReturnType<typeof useCharacterOwnership>;

function membersNote(ownership: Ownership) {
  const { candidates, candidatesStatus } = ownership;
  if (
    candidatesStatus === 'LoadingFirstPage' ||
    candidatesStatus === 'LoadingMore'
  )
    return 'Loading members…';
  if (candidatesStatus === 'Exhausted' && candidates.length === 0)
    return 'No current members.';
  return null;
}

// The owner picker (approved variant B's row-list dialog), inside the
// control's Dialog: the campaign's current members as one choice, the one in
// use and me noted, then Assign owner saves at once. Mounted only while
// open, so a reopened picker starts with no choice; a refused save keeps it
// open beside the reason.
export function OwnerPicker({
  characterName,
  ownership,
}: {
  characterName: string;
  ownership: Ownership;
}) {
  const chosen = ownership.candidates.find(
    (member) => member.userId === ownership.selectedUserId,
  );
  const note = membersNote(ownership);
  return (
    <DialogContent className="bg-card sm:max-w-sm">
      <DialogHeader>
        <DialogTitle className="font-sans">Choose owner</DialogTitle>
        <DialogDescription>
          Any current member of the campaign can own {characterName}.
        </DialogDescription>
      </DialogHeader>
      <RadioGroup
        aria-label="Members"
        value={ownership.selectedUserId ?? ''}
        disabled={ownership.isDisabled}
        onValueChange={ownership.selectOwner}
        className="max-h-[50dvh] gap-1 overflow-y-auto"
      >
        {ownership.candidates.map((member) => (
          <RadioGroupItem
            key={member.userId}
            value={member.userId}
            className="justify-start gap-2 font-sans"
          >
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              {member.name}
            </span>
            {member.userId === ownership.owner?.userId ? (
              <span className="text-muted-foreground font-mono text-xs">
                current owner
              </span>
            ) : null}
            {member.isMine ? (
              <span className="text-muted-foreground font-mono text-xs">
                me
              </span>
            ) : null}
          </RadioGroupItem>
        ))}
      </RadioGroup>
      {note ? (
        <p role="status" className="text-muted-foreground text-sm">
          {note}
        </p>
      ) : null}
      {ownership.candidatesStatus === 'CanLoadMore' ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`${action} justify-self-start`}
          onClick={ownership.loadMore}
        >
          Load more members
        </Button>
      ) : null}
      <SaveFeedback
        status={ownership.status}
        savedText="Owner assigned."
        savingText="Assigning owner…"
        shouldHideWhenIdle
      />
      <DialogFooter>
        <Button
          type="button"
          className={action}
          disabled={ownership.isDisabled || !chosen}
          onClick={() => {
            if (chosen) void ownership.assignOwner(chosen.userId);
          }}
        >
          Assign owner
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
