'use client';
import { Check, GripVertical } from 'lucide-react';
import { useChoiceCardDrag } from './use-choice-card-drag';
import { Button } from '~/components/ui/button';
export function ChoiceCards({
  label,
  value,
  choices,
  onChange,
  disabled,
}: {
  label: string;
  value: string | null;
  choices: { value: string; label: string; description?: string }[];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const pointer = useChoiceCardDrag({ disabled, onChoose: onChange });
  const selected = choices.find((choice) => choice.value === value);
  return (
    <fieldset className="min-w-0 space-y-2" disabled={disabled}>
      <legend className="text-sm font-semibold">{label}</legend>
      {/* Coarse pointers choose by tap only (a finger swipe scrolls), so the
          hint and the empty selection area stop offering drag there. */}
      <p className="text-muted-foreground text-xs">
        <span className="pointer-coarse:hidden">
          Tap a card, or drag it into the selection area.
        </span>
        <span className="hidden pointer-coarse:inline">
          Tap a card to choose it.
        </span>
      </p>
      <div
        ref={pointer.targetRef}
        role="group"
        aria-label={`${label} selection`}
        data-drop-active={pointer.drag?.overTarget ?? false}
        className="data-[drop-active=true]:border-primary data-[drop-active=true]:bg-primary/15 data-[drop-active=true]:ring-primary/40 short:min-h-0 short:p-2 min-h-20 rounded-lg border-2 border-dashed p-3 text-sm transition-colors data-[drop-active=true]:ring-2 pointer-coarse:min-h-0 pointer-coarse:p-2"
      >
        <p className="text-muted-foreground text-xs">Selected choice</p>
        <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">
          {selected?.label ?? (
            <>
              <span className="pointer-coarse:hidden">Drop a card here</span>
              <span className="hidden pointer-coarse:inline">
                None selected
              </span>
            </>
          )}
        </p>
      </div>
      {/* Short viewports stack the cards and lay each out as two lines (grip
          and label, then the description) so a whole card fits the scroll
          column. */}
      <div className="short:grid-cols-1 short:gap-2 grid grid-cols-2 items-stretch gap-3">
        {choices.map((choice) => (
          // Hover only lifts and tints the border: it never changes the fill or
          // text colour, so it cannot resemble or dim the selected card.
          <Button
            key={choice.value}
            type="button"
            variant="outline"
            aria-label={choice.label}
            aria-pressed={choice.value === value}
            onPointerDown={(event) => pointer.down(event, choice.value)}
            onPointerMove={pointer.move}
            onPointerUp={pointer.up}
            onPointerCancel={pointer.cancel}
            onLostPointerCapture={pointer.cancel}
            onKeyDown={pointer.keyDown}
            onClick={(event) => pointer.click(event, choice.value)}
            style={
              pointer.drag?.moved && pointer.drag.value === choice.value
                ? {
                    transform: `translate(${pointer.drag.x - pointer.drag.startX}px, ${pointer.drag.y - pointer.drag.startY}px)`,
                    position: 'relative',
                    zIndex: 20,
                    transition: 'none',
                  }
                : undefined
            }
            className="hover:border-primary/60 aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:hover:border-primary aria-pressed:hover:bg-primary/15 hover:bg-background hover:text-foreground short:min-h-0 short:flex-row short:flex-wrap short:items-center short:gap-x-2 short:gap-y-0.5 short:p-2 h-auto min-h-24 min-w-0 cursor-grab touch-manipulation flex-col items-start justify-start gap-2 rounded-lg border-2 p-3 text-left whitespace-normal transition-transform select-none hover:-translate-y-1 focus-visible:-translate-y-1 active:cursor-grabbing motion-reduce:transform-none"
          >
            <GripVertical
              aria-hidden
              className="text-muted-foreground size-4 pointer-coarse:hidden"
            />
            <span className="short:w-auto short:flex-1 flex w-full min-w-0 items-start justify-between gap-2">
              <span className="min-w-0 [overflow-wrap:anywhere] break-words">
                {choice.label}
              </span>
              {choice.value === value && (
                <Check aria-hidden className="size-4 shrink-0" />
              )}
            </span>
            {choice.description && (
              <span className="text-muted-foreground short:basis-full text-xs font-normal">
                {choice.description}
              </span>
            )}
          </Button>
        ))}
      </div>
      {pointer.feedback && (
        <p role="status" className="text-muted-foreground text-sm">
          {pointer.feedback}
        </p>
      )}
    </fieldset>
  );
}
