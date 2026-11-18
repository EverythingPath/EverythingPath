'use client';
import { Check } from 'lucide-react';
import { Button } from '~/components/ui/button';

// The grids the Event panels lay these cards out in: columns follow the
// viewport width; short viewports stack so a whole card fits the scroll
// column.
export const eventChoiceGridClass =
  'grid gap-2 not-short:sm:grid-cols-2 not-short:lg:grid-cols-3';
export const eventChoicePairGridClass = 'grid gap-2 not-short:sm:grid-cols-2';

// One pressable choice card in the Event panels: a visible label, a muted
// description and a check mark while pressed. Hover only lifts and tints the
// border, so it never resembles the pressed card. The owner decides what a
// press on the pressed card means: clearing is a separate, worded control.
export function EventChoiceCard({
  label,
  description,
  pressed,
  disabled,
  onPress,
  ariaLabel,
}: {
  label: string;
  description: string | null;
  pressed: boolean;
  disabled: boolean;
  onPress: () => void;
  ariaLabel?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onPress}
      className="hover:border-primary/60 aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:hover:border-primary aria-pressed:hover:bg-primary/15 hover:bg-background hover:text-foreground short:gap-0.5 short:p-2 flex h-auto min-h-14 w-full min-w-0 flex-col items-start justify-start gap-1 rounded-lg border-2 p-3 text-left whitespace-normal transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 motion-reduce:transform-none"
    >
      <span className="flex w-full min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
        {pressed && <Check aria-hidden className="size-4 shrink-0" />}
      </span>
      {description && (
        <span className="text-muted-foreground min-w-0 text-xs font-normal [overflow-wrap:anywhere]">
          {description}
        </span>
      )}
    </Button>
  );
}
