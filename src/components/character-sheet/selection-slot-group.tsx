'use client';
import { Plus } from 'lucide-react';
import { useId, useRef } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { InlineWarnings } from './inline-warning';
import { SelectionPicker } from './selection-picker';
import { SelectionRow } from './selection-row';
import { action, missingChoice } from './sheet-parts';
import {
  describeSlotNoun,
  type SelectionCandidateView,
  type SelectionControls,
  type SelectionLevelView,
  type SelectionRowView,
  type SelectionSlotView,
  type WarningController,
} from './selection-view-types';
import type { SheetWarningView } from './use-character-sheet';

type StoredRow = SelectionRowView & {
  entryId: NonNullable<SelectionRowView['entryId']>;
};

/** Where the picker is open in this section, and what opened it. */
export type OpenPicker = {
  slotId: string;
  position: number;
  replacing: StoredRow | null;
  opener: HTMLElement | null;
};

/** The first position no saved row holds: an open one, else the next extra. */
function nextPosition(rows: readonly SelectionRowView[]) {
  const taken = new Set(
    rows.flatMap((row) => (row.slot ? [row.slot.position] : [])),
  );
  let position = 0;
  while (taken.has(position)) position += 1;
  return position;
}

/** Filled of allowed, then what is still open or what is over. */
function SlotCount({ slot }: { slot: SelectionSlotView }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 font-mono text-xs">
      <span className="text-muted-foreground">
        {slot.used}/{slot.count}
      </span>
      {slot.remaining > 0 && slot.kind === 'feat' ? (
        <span className="text-sky-300">{slot.remaining} open</span>
      ) : null}
      {slot.remaining > 0 && slot.kind === 'trait' ? (
        <span className="text-muted-foreground">{slot.remaining} open</span>
      ) : null}
      {slot.remaining < 0 ? (
        <span className="text-amber-300">{-slot.remaining} over</span>
      ) : null}
    </span>
  );
}

/** What the slot usually takes; the picker still offers every candidate. */
function describeRestrictions(slot: SelectionSlotView) {
  const parts = [
    slot.featTypes?.length
      ? `Usually ${slot.featTypes.join(' or ')} feats`
      : null,
    slot.ignoresPrerequisites ? 'Prerequisites waived' : null,
  ].filter((part) => part !== null);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * One slot of the Feats & traits block: its label and count, its warnings,
 * the saved rows in slot order, and the add control that opens the picker
 * on the first open position. An unfilled feat slot wears the blue prompt;
 * Traits and the Drawback stay neutral. A full slot still takes an extra
 * choice, which the sheet flags as over the allowance.
 */
export function SelectionSlotGroup({
  slot,
  rows,
  candidates,
  levels,
  warnings,
  controls,
  warningController,
  picker,
  onOpenPicker,
  onClosePicker,
}: {
  slot: SelectionSlotView;
  rows: StoredRow[];
  candidates: SelectionCandidateView[];
  levels: SelectionLevelView[];
  /** This slot's allowance and trait-rule warnings. */
  warnings: SheetWarningView[];
  controls: SelectionControls;
  warningController: WarningController;
  picker: OpenPicker | null;
  onOpenPicker: (picker: OpenPicker) => void;
  onClosePicker: () => void;
}) {
  const headingId = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  const noun = describeSlotNoun(slot);
  const position = nextPosition(rows);
  const isPrompt = slot.kind === 'feat' && slot.remaining > 0;
  const isOpenHere = picker?.slotId === slot.id;
  const sorted = [...rows].sort(
    (left, right) => (left.slot?.position ?? 0) - (right.slot?.position ?? 0),
  );
  const restrictions = describeRestrictions(slot);

  // Focus goes back to what opened the picker, or to Add when that is gone.
  function closePicker(open: OpenPicker) {
    onClosePicker();
    const target = open.opener?.isConnected ? open.opener : addButton.current;
    target?.focus();
  }

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="border-foreground/10 flex min-w-0 flex-col gap-1 border-t pt-2 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3
          id={headingId}
          className="text-muted-foreground font-mono text-xs tracking-wide [overflow-wrap:anywhere] uppercase"
        >
          {slot.label}
        </h3>
        <SlotCount slot={slot} />
      </div>
      {restrictions ? (
        <p className="text-muted-foreground text-xs">{restrictions}</p>
      ) : null}
      <InlineWarnings
        warnings={warnings}
        controller={warningController}
        isNamedByMessage
      />
      {sorted.length > 0 ? (
        <ul className="divide-foreground/10 divide-y">
          {sorted.map((row) => (
            <SelectionRow
              key={row.rowId}
              row={row}
              levels={levels}
              controls={controls}
              warningController={warningController}
              onReplace={(opener) =>
                onOpenPicker({
                  slotId: slot.id,
                  position: row.slot?.position ?? position,
                  replacing: row,
                  opener,
                })
              }
              onRemoved={() => addButton.current?.focus()}
            />
          ))}
        </ul>
      ) : null}
      <Button
        ref={addButton}
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={isOpenHere}
        className={cn(
          action,
          'w-full justify-start border-dashed font-mono text-xs',
          isPrompt && cn(missingChoice, 'text-sky-300'),
        )}
        onClick={(event) =>
          isOpenHere && !picker.replacing
            ? closePicker(picker)
            : onOpenPicker({
                slotId: slot.id,
                position,
                replacing: null,
                opener: event.currentTarget,
              })
        }
      >
        <Plus aria-hidden className="size-3.5" />
        Add a {noun}
      </Button>
      {isOpenHere ? (
        <SelectionPicker
          key={`${picker.position}:${picker.replacing?.rowId ?? ''}`}
          slot={slot}
          position={picker.position}
          replacing={picker.replacing}
          candidates={candidates}
          levels={levels}
          controls={controls}
          onClose={() => closePicker(picker)}
          onSaved={() => closePicker(picker)}
        />
      ) : null}
    </div>
  );
}
