'use client';
import { LogOut } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '~/components/ui/button';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { MoveFeedback } from './character-move-feedback';
import { MoveGroupPreview } from './character-move-group';
import {
  groupDepartureText,
  moveGroupSubject,
  movingCompanionCount,
  privateDepartureNote,
} from './character-move-copy';
import { action } from './sheet-parts';
import type { useCharacterMove } from './use-character-move';

/**
 * Leave campaign's confirmation: what the requested Character loses, named
 * role by role, and, when active same-owner Companions leave with it (#711),
 * who they are and that each of them is corrected too. The roles listed are
 * the requested Character's own; the group's are stated as a whole.
 */
export function CharacterLeaveDialog({
  characterName,
  campaignName,
  isMilitiaOnly,
  movement,
  onStay,
  onLeave,
  onCloseAutoFocus,
}: {
  characterName: string;
  campaignName?: string;
  isMilitiaOnly: boolean;
  movement: ReturnType<typeof useCharacterMove>;
  onStay: () => void;
  onLeave: () => void;
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>['onCloseAutoFocus'];
}) {
  const companions = movingCompanionCount(movement.groupPreview);
  return (
    <DialogContent
      className="bg-card sm:max-w-md"
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <DialogHeader>
        <DialogTitle className="font-sans">
          Take {moveGroupSubject(characterName, companions)} out of{' '}
          {campaignName ?? 'its campaign'}?
        </DialogTitle>
        <DialogDescription>What changes:</DialogDescription>
      </DialogHeader>
      <MoveGroupPreview movement={movement} />
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {movement.departureRoles.map((role) => (
          <li key={role}>
            {companions ? `${characterName}’s ${role}` : role} assignment
            removed. Finished weeks keep it as it was.
          </li>
        ))}
        {companions ? <li>{groupDepartureText(companions)}</li> : null}
        <li>
          Campaign homebrew is kept as its own copy;{' '}
          {companions ? 'the sheets don’t change' : 'the sheet doesn’t change'}.
        </li>
        {isMilitiaOnly ? (
          <li>Militia-only becomes Full, which can’t be undone.</li>
        ) : null}
        <li>{privateDepartureNote(companions)}</li>
      </ul>
      <MoveFeedback movement={movement} outcome={null} />
      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          className={action}
          disabled={movement.isBusy}
          onClick={onStay}
        >
          Stay in {campaignName ?? 'campaign'}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className={action}
          disabled={!movement.canLeave}
          onClick={onLeave}
        >
          <LogOut aria-hidden /> Leave campaign
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
