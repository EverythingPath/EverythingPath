'use client';
import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { RULE_ROLL_SPECS } from '~/lib/rules-roll-spec';
import { cn } from '~/lib/utils';
import { RollTotalField } from './roll-total-field';
import type { EventIssue, EventView } from './types';
import { signed } from './upkeep-parts';
import type { useEventEdits } from './use-event-edits';

// The numbered Event steps share the Upkeep step look: a numbered ring that
// turns into a check once resolved, or a minus when the step does not apply
// this week. Everything here renders facts the view already decided.

export type EventStepStatus = 'open' | 'resolved' | 'collapsed';

export const PERCENTILE = RULE_ROLL_SPECS.percentile;

export type EventPreparation = {
  status: 'idle' | 'preparing' | 'failed';
  retry: () => void;
};

export function EventStep({
  number,
  title,
  status,
  effect,
  collapsed,
  children,
}: {
  number: number;
  title: string;
  status: EventStepStatus;
  effect: string;
  // The one muted line a collapsed step shows instead of its body.
  collapsed?: ReactNode;
  children?: ReactNode;
}) {
  const inactive = status === 'collapsed';
  return (
    <section
      aria-label={title}
      className={cn(
        'min-w-0 border-l-2 pl-4',
        inactive ? 'border-border opacity-70' : 'border-foreground/20',
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          aria-hidden
          className={cn(
            'bg-background flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-sm',
            status === 'resolved'
              ? 'border-emerald-500 text-emerald-500'
              : inactive
                ? 'border-border text-muted-foreground'
                : 'border-primary text-primary',
          )}
        >
          {status === 'resolved' ? (
            <Check className="size-4" />
          ) : inactive ? (
            <Minus className="size-3.5" />
          ) : (
            number
          )}
        </span>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere] sm:ml-auto">
          {effect}
        </p>
      </header>
      {inactive ? (
        collapsed && (
          <div className="text-muted-foreground mt-2 min-w-0 text-sm [overflow-wrap:anywhere]">
            {collapsed}
          </div>
        )
      ) : children ? (
        <div className="mt-3 min-w-0 space-y-4 pb-2">{children}</div>
      ) : null}
    </section>
  );
}

export function EventIssueNotes({ issues }: { issues: EventIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1">
      {issues.map((issue) => (
        <li
          key={issue.code}
          role="note"
          className="min-w-0 text-sm [overflow-wrap:anywhere] text-amber-300"
        >
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

// A link-styled action inside running text.
export function InlineAction({
  onClick,
  children,
  ariaLabel,
}: {
  onClick: () => void;
  children: ReactNode;
  // The accessible name when the visible words need context, e.g. the block.
  ariaLabel?: string;
}) {
  return (
    <Button
      type="button"
      variant="link"
      aria-label={ariaLabel}
      // Wraps like text: the button base is nowrap, which overflows a phone.
      className="h-auto max-w-full min-w-0 justify-start p-0 text-left text-sm [overflow-wrap:anywhere] whitespace-normal"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

// The store's status, or the view's when rendered without a store.
export function isPreparationFailed(
  view: EventView,
  preparation: EventPreparation | undefined,
) {
  return preparation?.status === 'failed' || view.preparation === 'failed';
}

export function PreparationNotice({
  view,
  preparation,
}: {
  view: EventView;
  preparation?: EventPreparation;
}) {
  if (isPreparationFailed(view, preparation))
    return (
      <div
        role="alert"
        className="bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-amber-500/50 p-3 text-sm"
      >
        <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          Some events the rules ask for could not be prepared. Your saved rolls
          are kept.
        </p>
        {preparation && (
          <Button type="button" variant="outline" onClick={preparation.retry}>
            Retry
          </Button>
        )}
      </div>
    );
  if (view.preparation === 'preparing')
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Preparing the events the rules ask for…
      </p>
    );
  return null;
}

function operatingLine(operating: EventView['chanceStep']['operating']) {
  if (!operating)
    return 'No operating settlement: no modifier on the chance roll.';
  const where = `${operating.name} (${operating.reputation ?? 'reputation unknown'})`;
  if (operating.modifier === null)
    return `${operating.name}’s reputation is unknown, so the chance roll cannot be compared yet.`;
  if (operating.modifier === 0)
    return `Operating from ${where}: no modifier on the chance roll.`;
  return `Operating from ${where} adds ${signed(operating.modifier)} to the chance roll.`;
}

// Step 1: the d100 against this week's event chance.
export function ChanceStep({
  number,
  view,
  edits,
  disabled,
  openActivity,
}: {
  number: number;
  view: EventView;
  edits: ReturnType<typeof useEventEdits>;
  disabled: boolean;
  openActivity?: () => void;
}) {
  const step = view.chanceStep;
  if (step.applies !== 'roll')
    return (
      <EventStep
        number={number}
        title="Event chance"
        status="collapsed"
        effect={step.effect}
        collapsed={
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span>{step.explanation}</span>
            {step.applies === 'guaranteed' && openActivity && (
              <InlineAction onClick={openActivity}>Open Activity</InlineAction>
            )}
          </p>
        }
      />
    );
  const operating = step.operating;
  // The raw die, the settlement adjustment and their total, e.g. 41 +5 Teilwood (Unfriendly) = 46.
  const adjustment = operating?.modifier ?? null;
  return (
    <EventStep
      number={number}
      title="Event chance"
      status={step.result === null ? 'open' : 'resolved'}
      effect={step.effect}
    >
      <div className="grid min-w-0 items-start gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <RollTotalField
          label="Event chance roll"
          spec={PERCENTILE}
          recorded={view.chanceRoll}
          required={step.required}
          disabled={disabled}
          onRoll={(roll) => edits.setChanceRoll(roll)}
        />
        <div className="min-w-0 space-y-1 sm:pt-7">
          <p className="text-muted-foreground text-xs">
            Below {view.chance}% means an event.
          </p>
          {step.raw !== null && (
            <p className="min-w-0 text-sm [overflow-wrap:anywhere]">
              <span className="font-mono">{step.raw}</span>
              {operating && adjustment !== null && adjustment !== 0 && (
                <>
                  {' '}
                  <span className="font-mono">{signed(adjustment)}</span>{' '}
                  <span className="text-muted-foreground">
                    {operating.name} ({operating.reputation})
                  </span>
                </>
              )}
              {step.total !== null && adjustment !== 0 && (
                <>
                  {' '}
                  = <strong className="font-mono">{step.total}</strong>
                </>
              )}
            </p>
          )}
          <div className="min-w-0 text-sm">
            <p>
              vs <strong className="font-mono">{view.chance}%</strong>
            </p>
            {step.breakdown.length > 0 && (
              <p className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
                {step.breakdown
                  .map((entry, index) =>
                    index === 0
                      ? `${entry.label} ${entry.value}`
                      : `${entry.value < 0 ? '−' : '+'} ${entry.label} ${Math.abs(entry.value)}`,
                  )
                  .join(' ')}
              </p>
            )}
          </div>
          {step.result && step.total !== null && (
            <p
              className={cn(
                'min-w-0 text-sm font-medium [overflow-wrap:anywhere]',
                step.result === 'event' ? 'text-amber-300' : 'text-emerald-500',
              )}
            >
              {step.result === 'event'
                ? `${step.total} is below ${view.chance}: an event happens`
                : `${step.total} is not below ${view.chance}: a quiet week`}
            </p>
          )}
        </div>
      </div>
      <p className="text-muted-foreground flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm [overflow-wrap:anywhere]">
        <span>{operatingLine(operating)}</span>
        {openActivity && (
          <InlineAction onClick={openActivity}>
            Change the operating settlement in Activity
          </InlineAction>
        )}
      </p>
      <EventIssueNotes issues={step.issues} />
    </EventStep>
  );
}
