'use client';
import { useId } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { OverseerToggleFacts } from './overseer-support-facts';
import { signed } from './upkeep-parts';

export type OverseerSupportToggleProps = {
  toggle: OverseerToggleFacts;
  // Names the check for assistive technology, e.g. "Event 2 Loyalty check".
  subject: string;
  disabled: boolean;
  // A move started from this toggle is in progress.
  moving: boolean;
  // Why the last move started here stopped, and where support is now.
  failure: string | null;
  onToggle: () => void;
  onRetry: () => void;
};

// The week's one Overseer support, as a switch under one check. It reads
// "Use Overseer support · +3 · one event a week" and never names the
// Overseer: the contribution is what the toggle adds here. Without a filled
// Overseer role there is no switch, only a line saying so (and a Remove when
// an older record still holds support); an event the rules do not use this
// week shows only that Remove.
export function OverseerSupportToggle({
  toggle,
  subject,
  disabled,
  moving,
  failure,
  onToggle,
  onRetry,
}: OverseerSupportToggleProps) {
  const hintId = useId();
  if (
    toggle.kind === 'unavailable' &&
    toggle.reason === 'unused' &&
    !toggle.recorded &&
    !failure
  )
    return null;
  if (toggle.kind === 'unavailable') {
    return (
      <div className="min-w-0 space-y-2 text-sm [overflow-wrap:anywhere]">
        {toggle.recorded ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p role="note" className="min-w-0 text-amber-300">
              {toggle.reason === 'unused'
                ? 'Overseer support is recorded here, but this event is not used this week, so it adds nothing.'
                : 'Overseer support is recorded here, but no Overseer is assigned, so it adds nothing.'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Remove Overseer support from ${subject}`}
              disabled={disabled}
              onClick={onToggle}
            >
              Remove Overseer support
            </Button>
          </div>
        ) : toggle.reason === 'unused' ? null : (
          <p className="text-muted-foreground min-w-0">
            No Overseer is assigned, so no Overseer support this week.
          </p>
        )}
        {failure && (
          <Failure failure={failure} disabled={disabled} onRetry={onRetry} />
        )}
      </div>
    );
  }
  const { on, elsewhere, contribution } = toggle;
  const where = elsewhere.join(' and ');
  const hint = !on && where ? `${hintId}-hint` : undefined;
  return (
    <div className="min-w-0 space-y-2 text-sm [overflow-wrap:anywhere]">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-describedby={hint}
          disabled={disabled}
          onClick={onToggle}
          className="focus-visible:ring-ring/50 inline-flex min-h-11 min-w-0 items-center gap-2 rounded-md py-1 pr-1 text-left outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50"
        >
          <span
            aria-hidden
            className={cn(
              'relative inline-block h-5 w-9 shrink-0 rounded-full border transition-colors motion-reduce:transition-none',
              on ? 'bg-primary border-primary' : 'border-foreground/40',
            )}
          >
            <span
              className={cn(
                'bg-background absolute top-0.5 left-0.5 size-3.5 rounded-full transition-transform motion-reduce:transition-none',
                on ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </span>
          <span className="min-w-0">
            Use Overseer support{' '}
            <span className="text-muted-foreground">
              · <span className="font-mono">{signed(contribution)}</span> · one
              event a week
            </span>{' '}
            <span className="sr-only">for {subject}</span>
          </span>
        </button>
        {moving && (
          <p role="status" className="text-muted-foreground min-w-0 text-xs">
            Moving Overseer support…
          </p>
        )}
        {!on && where && (
          <p id={hint} className="text-muted-foreground min-w-0 text-xs">
            Now on {where}. Tapping moves it here.
          </p>
        )}
      </div>
      {on && where && (
        <p role="note" className="min-w-0 text-amber-300">
          Also recorded on {where}. It counts for one event only; turn it off
          here or tap it there to move it.
        </p>
      )}
      {failure && (
        <Failure failure={failure} disabled={disabled} onRetry={onRetry} />
      )}
    </div>
  );
}

function Failure({
  failure,
  disabled,
  onRetry,
}: {
  failure: string;
  disabled: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
      <p role="alert" className="text-destructive min-w-0">
        {failure}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Try again: move Overseer support"
        disabled={disabled}
        onClick={onRetry}
      >
        Try again
      </Button>
    </div>
  );
}
