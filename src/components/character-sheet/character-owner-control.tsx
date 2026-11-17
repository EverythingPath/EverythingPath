'use client';
import { UserRoundCheck, UserRoundPen } from 'lucide-react';
import type { ReactNode } from 'react';
import type { CharacterOwner } from '~/lib/character-ownership';
import { Button } from '~/components/ui/button';
import { Dialog, DialogTrigger } from '~/components/ui/dialog';
import { cn } from '~/lib/utils';
import { OwnerPicker } from './owner-picker';
import { action, fieldLabel, RemoteNotice, SaveFeedback } from './sheet-parts';
import type { useCharacterOwnership } from './use-character-ownership';

/** The remote-change notice: the owner went to another member, or to nobody. */
function remoteOwnerChangeText(owner: CharacterOwner | null | undefined) {
  return owner === null
    ? 'This Character no longer has an owner.'
    : 'Owner changed by another player.';
}

/**
 * A campaign Character's owner, with Assign owner for any current member of
 * the campaign (#300). One that nobody owns (#708) also offers Take
 * ownership, one click for the viewer themself. Nothing for a private
 * Character, whose owner is the only one who sees it. The host places the
 * maintenance reason: a sheet's lifecycle row and a Characters list each show
 * one for their controls. Save feedback sits in the open picker, and beside
 * the owner once it has closed, so one live region speaks at a time.
 */
export function CharacterOwnerControl({
  characterName,
  isLabelled = true,
  needsOwnerLabel,
  ownership,
}: {
  /** Names the Character in Assign owner, as several controls can coexist. */
  characterName: string;
  ownership: ReturnType<typeof useCharacterOwnership>;
  /** False in a table whose column header already reads Owner. */
  isLabelled?: boolean;
  /** Stands in for the muted "Needs an owner" text, such as a list's badge. */
  needsOwnerLabel?: ReactNode;
}) {
  if (!ownership.isAvailable) return null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {isLabelled ? <span className={fieldLabel}>Owner</span> : null}
      <span
        className={cn(
          'min-w-0 [overflow-wrap:anywhere]',
          ownership.owner === null && 'text-muted-foreground',
        )}
      >
        {ownership.needsOwner && needsOwnerLabel
          ? needsOwnerLabel
          : ownership.ownerLabel}
        {ownership.isMine ? (
          <span className="text-muted-foreground"> (me)</span>
        ) : null}
      </span>
      {ownership.needsOwner ? (
        <Button
          type="button"
          size="sm"
          className={action}
          disabled={ownership.isTakeOwnershipDisabled}
          aria-label={`Take ownership of ${characterName}`}
          onClick={() => void ownership.takeOwnership()}
        >
          <UserRoundCheck aria-hidden /> Take ownership
        </Button>
      ) : null}
      <Dialog
        open={ownership.isPickerOpen}
        onOpenChange={ownership.setIsPickerOpen}
      >
        <DialogTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={action}
            disabled={ownership.isDisabled}
            aria-label={`Assign owner for ${characterName}`}
          >
            <UserRoundPen aria-hidden /> Assign owner
          </Button>
        </DialogTrigger>
        {ownership.isPickerOpen ? (
          <OwnerPicker characterName={characterName} ownership={ownership} />
        ) : null}
      </Dialog>
      {ownership.isPickerOpen ? null : (
        <SaveFeedback
          status={ownership.status}
          savedText="Owner assigned."
          savingText="Assigning owner…"
          shouldHideWhenIdle
        />
      )}
      <RemoteNotice
        isShown={ownership.hasRemoteChange}
        message={remoteOwnerChangeText(ownership.owner)}
        subject="owner"
        onDismiss={ownership.dismissRemoteChange}
      />
    </div>
  );
}
