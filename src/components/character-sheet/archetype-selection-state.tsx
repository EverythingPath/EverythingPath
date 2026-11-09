'use client';
import { SquarePen } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import type {
  ArchetypeSelection,
  ArchetypesController,
} from './character-sheet-archetypes-view-model';
import { EntryStateEditor } from './entry-state-editor';
import type { SaveStatus } from './save-status';
import { SaveFeedback } from './sheet-parts';

/**
 * What the table recorded on an Archetype Selection, its choice and notes,
 * with Edit beside the Selection's other actions. A save sends only the
 * fields the player changed, so it never overwrites another player's edit
 * of the other field, and leaves the Selection's state and replacements as
 * they are. A refused save keeps the editor and what was entered.
 */
export function ArchetypeSelectionState({
  subject,
  selection,
  actions,
  feedbackStatus,
  onWrite,
  children,
}: {
  /** The Archetype and its class, as in "Scout for Rogue". */
  subject: string;
  selection: ArchetypeSelection;
  actions: ArchetypesController;
  /** The Selection's save status while its latest save came from here. */
  feedbackStatus: SaveStatus;
  onWrite: () => void;
  /** The Selection's other actions, beside Edit. */
  children: ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const isSaving = actions.statusFor(selection._id).kind === 'saving';
  const choice = selection.state.choice ?? null;
  const notes = selection.notes ?? '';
  const recorded = [choice ? `Choice: ${choice}` : null, notes || null]
    .filter((text) => text !== null)
    .join(' · ');

  function closeEditor() {
    setIsEditing(false);
    editButton.current?.focus();
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        {recorded ? (
          <p className="min-w-0 flex-1 text-xs [overflow-wrap:anywhere]">
            {recorded}
          </p>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button
            ref={editButton}
            type="button"
            variant={isEditing ? 'secondary' : 'ghost'}
            size="icon"
            className="size-11 md:size-8"
            aria-pressed={isEditing}
            onClick={() => setIsEditing(!isEditing)}
          >
            <SquarePen aria-hidden className="size-4" />
            <span className="sr-only">Edit {subject}</span>
          </Button>
          {children}
        </div>
      </div>
      {isEditing ? (
        <EntryStateEditor
          subject={subject}
          choice={choice}
          notes={notes}
          canEditChoice
          isSaving={isSaving}
          onSave={(state, changed) => {
            if (!changed.choice && !changed.notes) return Promise.resolve(true);
            onWrite();
            return actions.editSelection({
              entryId: selection._id,
              ...(changed.notes ? { notes: state.notes } : {}),
              ...(changed.choice ? { choice: state.choice } : {}),
            });
          }}
          onClose={closeEditor}
        />
      ) : null}
      <SaveFeedback
        status={feedbackStatus}
        savedText="Saved"
        savingText="Saving…"
        shouldHideWhenIdle
      />
    </div>
  );
}
