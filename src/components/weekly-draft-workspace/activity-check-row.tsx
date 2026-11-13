'use client';
import { X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { RollTotalField } from './roll-total-field';
import type {
  ActivityCheck,
  ActivityRecordedModifier,
  ActivityView,
} from './types';
import type { ActivityBoard } from './use-activity-board';

// The organization check of one staged choice: the dice total, the bonus the
// rules calculated beside it, the Helpful settlement support, and the
// modifiers recorded on the roll. The entered dice never include the bonus.

type Slot = ActivityView['slots'][number];

export function signed(value: number) {
  return value < 0 ? String(value) : `+${value}`;
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function list(numbers: number[]) {
  return numbers.length <= 1
    ? String(numbers[0] ?? '')
    : `${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)}`;
}

// "Check · Loyalty DC 15"; the dice are stated once, on the field itself.
export function checkLegend(check: ActivityCheck) {
  const kind = [
    check.organizationCheck ? capitalise(check.organizationCheck) : null,
    check.dc !== null ? `DC ${check.dc}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  return ['Check', kind || null].filter(Boolean).join(' · ');
}

export function ActivityCheckRow({
  slot,
  check,
  recorded,
  board,
  disabled,
}: {
  slot: Slot;
  check: ActivityCheck;
  recorded: RawRoll | undefined;
  board: ActivityBoard;
  disabled: boolean;
}) {
  const choiceId = slot.choice?.choiceId;
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold">{checkLegend(check)}</legend>
      <div className="grid items-start gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <RollTotalField
          label="Check roll"
          spec={check.spec}
          recorded={recorded}
          disabled={disabled}
          required={slot.requirements.some((requirement) =>
            requirement.startsWith(`${choiceId}:check:`),
          )}
          onRoll={(roll) => board.setCheckRoll(slot.slotId, roll)}
        />
        <div className="min-w-0 space-y-1 text-sm sm:pt-6">
          {check.modifier === null ? (
            <p className="text-muted-foreground">
              The bonus is calculated once this choice&apos;s required
              selections are made.
            </p>
          ) : (
            <p className="flex flex-wrap gap-x-3">
              <span>
                Bonus{' '}
                <strong className="font-mono">{signed(check.modifier)}</strong>
              </span>
              {check.total !== null ? (
                <span>
                  = <strong className="font-mono">{check.total}</strong>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Total after the roll
                </span>
              )}
            </p>
          )}
          {check.breakdown.length > 0 && (
            <p className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
              {check.breakdown
                .map((entry) => `${entry.label} ${signed(entry.value)}`)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}

// Helpful +2 from the operating settlement, once per Activity. Applying it
// elsewhere moves it; the board reports the move and any failure here.
export function ActivityHelpful({
  slot,
  helpful,
  recorded,
  board,
  disabled,
}: {
  slot: Slot;
  helpful: NonNullable<ActivityView['helpful']>;
  recorded: RawRoll | undefined;
  board: ActivityBoard;
  disabled: boolean;
}) {
  const here = slot.modifiers.some((modifier) => modifier.kind === 'helpful');
  const elsewhere = helpful.usedIn.filter((use) => use.slotId !== slot.slotId);
  const status = board.helpful;
  const moving = status.state === 'moving';
  const mine = status.state !== 'idle' && status.slotId === slot.slotId;
  return (
    <div className="space-y-2">
      {here ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm">
            Helpful +2 applies to this check ({helpful.settlementName}).
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => board.removeHelpful(slot.slotId)}
          >
            Remove Helpful
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !recorded || moving}
            onClick={() => void board.applyHelpful(slot.slotId)}
            className="h-auto min-h-9 max-w-full whitespace-normal"
          >
            Use Helpful +2 ({helpful.settlementName}, once per Activity)
          </Button>
          {elsewhere.length > 0 && (
            <p className="text-muted-foreground text-sm">
              Now on Action Slot {list(elsewhere.map((use) => use.slotNumber))}.
              Tapping moves it here.
            </p>
          )}
        </div>
      )}
      <p
        role="status"
        className={cn(
          'text-muted-foreground text-sm',
          !(mine && moving) && 'sr-only',
        )}
      >
        {mine && moving ? 'Moving Helpful…' : ''}
      </p>
      {mine && status.state === 'failed' && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 border-l-2 border-amber-500/60 pl-3"
        >
          <p className="text-sm text-amber-300">{status.message}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => void board.applyHelpful(slot.slotId)}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

// Modifiers recorded on the check roll, each removable by its own position so
// retained legacy or duplicate entries can be cleared one at a time.
export function ActivityModifierList({
  slot,
  modifiers,
  board,
  disabled,
}: {
  slot: Slot;
  modifiers: ActivityRecordedModifier[];
  board: ActivityBoard;
  disabled: boolean;
}) {
  if (modifiers.length === 0) return null;
  return (
    <ul
      aria-label="Recorded modifiers"
      className="max-w-xl divide-y rounded-md border text-sm"
    >
      {modifiers.map((modifier) => (
        <li
          key={modifier.index}
          className="flex min-h-11 items-center gap-3 px-3 py-1.5"
        >
          <span className="w-8 shrink-0 font-mono">
            {signed(modifier.value)}
          </span>
          <span className="min-w-0 flex-1 space-y-0.5 [overflow-wrap:anywhere]">
            <span className="block">
              {modifier.label}
              {(modifier.kind === 'custom' || modifier.kind === 'unknown') &&
                modifier.reason &&
                modifier.reason !== modifier.label && (
                  <span className="text-muted-foreground">
                    {' '}
                    · {modifier.reason}
                  </span>
                )}
            </span>
            {modifier.warning && (
              <span role="note" className="block text-xs text-amber-300">
                {modifier.warning}
              </span>
            )}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove modifier ${modifier.label}`}
            disabled={disabled}
            onClick={() => board.removeModifier(slot.slotId, modifier.index)}
          >
            <X aria-hidden className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
