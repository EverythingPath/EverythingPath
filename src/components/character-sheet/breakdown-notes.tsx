'use client';
import type { SourcedSituationalNote } from '~/lib/character-sheet';
import { cn } from '~/lib/utils';
import { fieldLabel } from './sheet-parts';
import { useEntrySituationNotes } from './breakdown-resolver';
import { describeNoteCondition } from './situation-copy';

/** Notes may repeat their words, so their place keeps them apart. */
export const noteKey = (note: SourcedSituationalNote, index: number) =>
  `${note.sheetEntryId}|${note.noteIndex ?? index}`;

/**
 * Situational Notes beside a number: rules that change no total, as text,
 * with the entry they come from. One still waiting on an entry is dimmed
 * and says what it waits on.
 */
export function BreakdownNotes({
  notes: providedNotes,
  entryId,
  hasSituation = entryId !== undefined,
  className,
}: {
  notes?: readonly SourcedSituationalNote[];
  entryId?: string;
  /** Say each note's Situation; off where a heading already does. */
  hasSituation?: boolean;
  className?: string;
}) {
  const resolver = useEntrySituationNotes(entryId ?? '');
  const notes = providedNotes ?? resolver.notes;
  const isEntry = entryId !== undefined;
  if (notes.length === 0) return null;
  const content = (
    <ul className={cn('space-y-1', !isEntry && className)}>
      {notes.map((note, index) => {
        const condition = describeNoteCondition(note, {
          findPrerequisiteName: resolver.findPrerequisiteName,
          findCastingClassName: resolver.findCastingClassName,
          hasSituation,
        });
        return (
          <li
            key={noteKey(note, index)}
            className={cn(
              !isEntry && '[overflow-wrap:anywhere]',
              note.waiting && 'text-muted-foreground/70',
            )}
          >
            {isEntry ? null : (
              <span className="text-muted-foreground">{note.entryName}: </span>
            )}
            {note.text}
            {condition ? (
              <span
                className={cn(
                  'text-muted-foreground block',
                  !isEntry && 'text-xs',
                )}
              >
                {note.waiting ? `Waiting: ${condition}` : condition}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
  return isEntry ? (
    <div className={cn('text-xs [overflow-wrap:anywhere]', className)}>
      <p className={fieldLabel}>Rules</p>
      {content}
    </div>
  ) : (
    content
  );
}
