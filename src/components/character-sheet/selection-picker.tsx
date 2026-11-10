'use client';
import type { Id } from '@convex/_generated/dataModel';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, GripVertical, X } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { useChoiceCardDrag } from '~/components/weekly-draft-workspace/use-choice-card-drag';
import { ChoiceSelect } from './choice-select';
import { SelectionDescription } from './selection-description';
import { SelectionGuidance } from './selection-guidance';
import { SelectionPreviewDetails } from './selection-preview';
import { action, fieldLabel, SaveFeedback } from './sheet-parts';
import {
  describeSlotNoun,
  findRecordedLevel,
  type SelectionCandidateView,
  type SelectionControls,
  type SelectionLevelView,
  type SelectionPreview,
  type SelectionRowView,
  type SelectionSlotView,
} from './selection-view-types';

/** Enough cards to browse; the search narrows a long catalog. */
const shownCardLimit = 30;

// Hover lifts and tints the border only, so a hovered card never imitates
// the staged one (approved playing-card choices).
const card =
  'hover:border-primary/60 aria-pressed:border-primary aria-pressed:bg-primary/15 hover:bg-background hover:text-foreground h-auto min-h-11 w-full min-w-0 cursor-grab touch-manipulation flex-col items-start justify-start gap-0.5 border-2 px-2.5 py-1.5 text-left whitespace-normal transition-transform select-none active:cursor-grabbing motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5 motion-reduce:transform-none';

type Preview =
  | { kind: 'ready'; preview: SelectionPreview }
  | { kind: 'unavailable' }
  | { kind: 'failed' };

/**
 * The structural part of a Selection: a free-text choice and, for a feat, a Class
 * Level from the list or none. Rules are never checked here.
 */
function selectionSchema(levels: readonly SelectionLevelView[]) {
  return z.object({
    choice: z.string(),
    level: z
      .string()
      .refine(
        (value) =>
          value === '' || levels.some((level) => level.entryId === value),
        'Choose a level from the list.',
      ),
  });
}
type SelectionValues = z.infer<ReturnType<typeof selectionSchema>>;

function describeUnavailable({
  slot,
  candidate,
}: {
  slot: SelectionSlotView;
  candidate: SelectionCandidateView | undefined;
}) {
  if (!candidate) return 'That card is no longer available. Nothing changed.';
  if (candidate.unavailableReason)
    return `${candidate.name}: ${candidate.unavailableReason} Nothing changed.`;
  if (candidate.kind !== slot.kind)
    return `${candidate.name} is a ${candidate.kind}, so it can't fill this ${describeSlotNoun(slot)} slot. Nothing changed.`;
  return 'This slot is no longer on the sheet. Nothing changed.';
}

function SelectionCard({
  candidate,
  isStaged,
  pointer,
}: {
  candidate: SelectionCandidateView;
  isStaged: boolean;
  pointer: ReturnType<typeof useChoiceCardDrag> & {
    onPress: () => void;
  };
}) {
  const nameId = useId();
  const descriptionId = useId();
  const proseId = useId();
  const unavailableId = useId();
  const isUnavailable = candidate.unavailableReason !== null;
  const describedBy = [
    isUnavailable ? unavailableId : null,
    candidate.description.trim() ? descriptionId : null,
    candidate.prerequisiteText ? proseId : null,
  ].filter((id) => id !== null);
  const drag = pointer.drag;
  const isDragged =
    drag?.moved === true && drag.value === candidate.catalogEntryId;
  return (
    <li className="min-w-0">
      <Button
        type="button"
        variant="outline"
        aria-pressed={isStaged}
        disabled={isUnavailable}
        aria-labelledby={nameId}
        aria-describedby={describedBy.join(' ') || undefined}
        onPointerDown={(event) => {
          pointer.onPress();
          pointer.down(event, candidate.catalogEntryId);
        }}
        onPointerMove={pointer.move}
        onPointerUp={pointer.up}
        onPointerCancel={pointer.cancel}
        onLostPointerCapture={pointer.cancel}
        onKeyDown={pointer.keyDown}
        onClick={(event) => pointer.click(event, candidate.catalogEntryId)}
        style={
          isDragged
            ? {
                transform: `translate(${drag.x - drag.startX}px, ${drag.y - drag.startY}px)`,
                position: 'relative',
                zIndex: 20,
                transition: 'none',
              }
            : undefined
        }
        className={card}
      >
        <span className="flex w-full min-w-0 items-start gap-1.5">
          <GripVertical
            aria-hidden
            className="text-muted-foreground mt-0.5 size-3.5 shrink-0 pointer-coarse:hidden"
          />
          <span
            id={nameId}
            className="min-w-0 flex-1 font-sans text-sm [overflow-wrap:anywhere]"
          >
            {candidate.name}
          </span>
          {isStaged ? <Check aria-hidden className="size-4 shrink-0" /> : null}
        </span>
        {isUnavailable ? (
          <span
            id={unavailableId}
            className="text-muted-foreground text-xs font-normal [overflow-wrap:anywhere]"
          >
            {candidate.unavailableReason}
          </span>
        ) : null}
        {candidate.description.trim() ? (
          <span
            id={descriptionId}
            className="line-clamp-2 text-xs font-normal [overflow-wrap:anywhere]"
          >
            {candidate.description}
          </span>
        ) : null}
        {candidate.prerequisiteText ? (
          <span
            id={proseId}
            className="text-muted-foreground line-clamp-2 text-xs font-normal [overflow-wrap:anywhere]"
          >
            {candidate.prerequisiteText}
          </span>
        ) : null}
      </Button>
    </li>
  );
}

/**
 * Choosing what fills one slot position (approved playing-card choices):
 * search, then tap a card or drag it into the highlighted selection area.
 * The staged card shows what its prerequisites would be, now and at the
 * level gained, and every candidate stays selectable: a failed check is an
 * advisory, never a block. A card the slot cannot take returns to the list
 * with the reason. The picker keeps its input until the save succeeds, and
 * Escape or Close leaves without an edit.
 */
export function SelectionPicker({
  slot,
  position,
  replacing,
  candidates,
  levels,
  controls,
  onClose,
  onSaved,
}: {
  slot: SelectionSlotView;
  position: number;
  replacing: SelectionRowView | null;
  candidates: SelectionCandidateView[];
  levels: SelectionLevelView[];
  controls: SelectionControls;
  onClose: () => void;
  onSaved: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const titleId = useId();
  const noun = describeSlotNoun(slot);
  const isFeat = slot.kind === 'feat';
  const [query, setQuery] = useState('');
  const [stagedId, setStagedId] = useState<Id<'catalogEntry'> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm<SelectionValues>({
    resolver: zodResolver(selectionSchema(levels)),
    defaultValues: {
      choice: replacing?.choice ?? '',
      level:
        findRecordedLevel(levels, replacing?.gainedAtClassLevel ?? null)
          ?.entryId ?? '',
    },
  });
  const [choiceValue, levelValue] = useWatch({
    control: form.control,
    name: ['choice', 'level'],
  });
  const values = { choice: choiceValue, level: levelValue };
  const status = controls.statusForSlot(slot.id, position);
  const isSaving = status.kind === 'saving';
  const isDisabled = isSaving || maintenance.readOnly;

  function previewFor(
    catalogEntryId: Id<'catalogEntry'>,
    { choice, level }: SelectionValues,
  ): Preview {
    try {
      const preview = controls.preview({
        slotId: slot.id,
        position,
        catalogEntryId,
        choice: choice.trim() || null,
        ...(isFeat
          ? {
              gainedAtClassLevel:
                findRecordedLevel(levels, level || null)?.entryId ?? null,
            }
          : {}),
      });
      return preview ? { kind: 'ready', preview } : { kind: 'unavailable' };
    } catch {
      return { kind: 'failed' };
    }
  }

  function stage(catalogEntryId: string) {
    const candidate = candidates.find(
      (candidate) => candidate.catalogEntryId === catalogEntryId,
    );
    const result = candidate
      ? previewFor(candidate.catalogEntryId, form.getValues())
      : ({ kind: 'unavailable' } as const);
    if (
      !candidate ||
      candidate.unavailableReason ||
      result.kind === 'unavailable'
    ) {
      setNotice(describeUnavailable({ slot, candidate }));
      return;
    }
    setNotice(null);
    setStagedId(candidate.catalogEntryId);
  }

  const pointer = useChoiceCardDrag({ disabled: isDisabled, onChoose: stage });
  const staged = candidates.find(
    (candidate) => candidate.catalogEntryId === stagedId,
  );
  const preview = staged ? previewFor(staged.catalogEntryId, values) : null;
  const kindCandidates = candidates
    .filter((candidate) => candidate.kind === slot.kind)
    .sort((left, right) => left.name.localeCompare(right.name));
  const search = query.trim().toLowerCase();
  const matches = search
    ? kindCandidates.filter((candidate) =>
        candidate.name.toLowerCase().includes(search),
      )
    : kindCandidates;

  async function save(submitted: SelectionValues) {
    if (!staged || isDisabled) return;
    if (!Number.isSafeInteger(position) || position < 0) {
      setNotice('Choose an open slot. Nothing changed.');
      return;
    }
    if (previewFor(staged.catalogEntryId, submitted).kind === 'unavailable') {
      setNotice(describeUnavailable({ slot, candidate: staged }));
      return;
    }
    const isSaved = await controls.fill({
      slotId: slot.id,
      position,
      catalogEntryId: staged.catalogEntryId,
      choice: submitted.choice.trim() || null,
      ...(isFeat
        ? {
            gainedAtClassLevel:
              findRecordedLevel(levels, submitted.level || null)?.entryId ??
              null,
          }
        : {}),
    });
    if (isSaved) onSaved();
  }

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    // A menu or a dragged card handles its own Escape first.
    if (
      event.key !== 'Escape' ||
      event.defaultPrevented ||
      !(
        event.target instanceof Node &&
        event.currentTarget.contains(event.target)
      )
    )
      return;
    event.preventDefault();
    onClose();
  }

  // A staged card another player's change took away goes back with a reason.
  const feedback =
    notice ??
    (stagedId !== null && !staged
      ? describeUnavailable({ slot, candidate: undefined })
      : pointer.feedback);
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      onKeyDown={closeOnEscape}
      className="border-foreground/30 bg-background mt-2 flex min-w-0 flex-col gap-2 border p-2"
    >
      <div className="flex items-center justify-between gap-2">
        <p
          id={titleId}
          className="min-w-0 font-sans text-sm [overflow-wrap:anywhere]"
        >
          {replacing ? `Replace ${replacing.name}` : `Choose a ${noun}`}
          <span className="sr-only"> for {slot.label}</span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 md:size-8"
          onClick={onClose}
        >
          <X aria-hidden className="size-4" />
          <span className="sr-only">Close picker</span>
        </Button>
      </div>
      {kindCandidates.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {isFeat ? 'No feats available' : 'No traits available'}
        </p>
      ) : (
        <>
          <Input
            type="search"
            autoFocus
            autoComplete="off"
            aria-label={`Search ${isFeat ? 'feats' : 'traits'}`}
            placeholder={`Search ${isFeat ? 'feats' : 'traits'}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 md:h-8"
          />
          <p className="text-muted-foreground text-xs">
            <span className="pointer-coarse:hidden">
              Tap a card, or drag it into the selection area.
            </span>
            <span className="hidden pointer-coarse:inline">
              Tap a card to choose it.
            </span>
          </p>
          {matches.length === 0 ? (
            <p className="text-muted-foreground text-sm [overflow-wrap:anywhere]">
              No {isFeat ? 'feats' : 'traits'} match “{query.trim()}”.
            </p>
          ) : (
            <ul
              aria-label={isFeat ? 'Feats' : 'Traits'}
              className="grid max-h-72 grid-cols-1 gap-1.5 overflow-y-auto p-1 sm:grid-cols-2"
            >
              {matches.slice(0, shownCardLimit).map((candidate) => (
                <SelectionCard
                  key={candidate.catalogEntryId}
                  candidate={candidate}
                  isStaged={candidate.catalogEntryId === stagedId}
                  pointer={{ ...pointer, onPress: () => setNotice(null) }}
                />
              ))}
            </ul>
          )}
          {matches.length > shownCardLimit ? (
            <p className="text-muted-foreground text-xs">
              Showing {shownCardLimit} of {matches.length}. Search to narrow the
              list.
            </p>
          ) : null}
        </>
      )}
      {feedback ? (
        <p role="status" className="text-muted-foreground text-xs">
          {feedback}
        </p>
      ) : null}
      <Form {...form}>
        <form
          noValidate
          aria-label={`New ${noun}`}
          className="flex min-w-0 flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit(save)();
          }}
        >
          <div
            ref={pointer.targetRef}
            role="group"
            aria-label={`${slot.label} selection`}
            data-drop-active={pointer.drag?.overTarget ?? false}
            className="data-[drop-active=true]:border-primary data-[drop-active=true]:bg-primary/15 border-foreground/30 min-h-14 border-2 border-dashed p-2 text-sm transition-colors"
          >
            {staged ? (
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-sans text-base [overflow-wrap:anywhere]">
                  {staged.name}
                </p>
                <SelectionDescription text={staged.description} />
                <SelectionGuidance text={staged.guidanceText} />
                {preview?.kind === 'ready' ? (
                  <SelectionPreviewDetails preview={preview.preview} />
                ) : preview?.kind === 'failed' ? (
                  <p className="text-muted-foreground text-xs">
                    Prerequisites can’t be shown right now. You can still add
                    it.
                  </p>
                ) : (
                  <p className="text-xs text-amber-300">
                    {describeUnavailable({ slot, candidate: staged })}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">
                <span className="pointer-coarse:hidden">Drop a card here</span>
                <span className="hidden pointer-coarse:inline">
                  None selected
                </span>
              </p>
            )}
          </div>
          {staged ? (
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <FormField
                control={form.control}
                name="choice"
                render={({ field }) => (
                  <FormItem className="min-w-0 flex-1 basis-40 gap-0.5">
                    <FormLabel className={fieldLabel}>Choice</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="off"
                        className="h-11 md:h-8"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              {isFeat ? (
                <FormField
                  control={form.control}
                  name="level"
                  render={({ field, fieldState }) => (
                    <FormItem className="min-w-0 flex-1 basis-40 gap-0.5">
                      <FormLabel className={fieldLabel}>Level gained</FormLabel>
                      <ChoiceSelect
                        label="Level gained"
                        value={field.value}
                        emptyLabel="No level"
                        options={levels.map((level) => ({
                          value: level.entryId,
                          label: level.label,
                        }))}
                        className="h-11 md:h-8"
                        onValueChange={field.onChange}
                        renderTrigger={(trigger) => (
                          <FormControl>{trigger}</FormControl>
                        )}
                      />
                      {fieldState.error ? <FormMessage role="alert" /> : null}
                    </FormItem>
                  )}
                />
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {staged ? (
              <Button
                type="submit"
                size="sm"
                className={action}
                aria-describedby={reasonId}
                disabled={isDisabled}
              >
                {isSaving
                  ? 'Saving…'
                  : replacing
                    ? `Replace with ${staged.name}`
                    : `Add ${staged.name}`}
              </Button>
            ) : null}
            <SaveFeedback
              status={status}
              savedText="Saved."
              shouldHideWhenIdle
            />
          </div>
        </form>
      </Form>
    </div>
  );
}
