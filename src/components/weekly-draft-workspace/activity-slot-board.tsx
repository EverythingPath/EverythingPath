'use client';
import { Check, CircleDot, Plus, Sparkles, X } from 'lucide-react';
import { useId } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { actionTeamTypes } from '~/lib/rules-action-teams';
import { cn } from '~/lib/utils';
import { activitySlotAnchor } from './source-anchors';
import type { ActivityView } from './types';
import type { ActivityBoard } from './use-activity-board';

// The Activity header line and the numbered slot board. The header reads the
// allowance the rules derived; the board shows every slot as one tappable
// card. Empty slots open the picker, occupied ones select their details.

type Slot = ActivityView['slots'][number];
const NONE = '__none__';

// "3 from rank 8 + 1 Strategist", or why the rank table gives nothing.
function allowanceSource(allowance: ActivityView['allowance']) {
  return allowance.rankActions === null
    ? `rank ${allowance.rank} has no action allowance row`
    : `${allowance.rankActions} from rank ${allowance.rank}${
        allowance.strategist ? ' + 1 Strategist' : ''
      }`;
}

const removalBlockedNotes = {
  upkeep: 'Extra empty slots can be removed once Upkeep is complete.',
  unknown:
    'Extra empty slots can be removed once earlier officer changes are complete.',
};

function OperatingFrom({
  operating,
  board,
  disabled,
  correctionsHref,
}: {
  operating: ActivityView['operating'];
  board: ActivityBoard;
  disabled: boolean;
  correctionsHref?: string;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={id} className="text-muted-foreground font-normal">
          Operating from
        </Label>
        <Select
          value={operating.selected ?? NONE}
          disabled={disabled}
          onValueChange={(value) =>
            board.setOperatingSettlement(value === NONE ? null : value)
          }
        >
          <SelectTrigger id={id} size="sm" className="max-w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No settlement</SelectItem>
            {operating.missing && operating.selected && (
              <SelectItem value={operating.selected}>
                Missing settlement
              </SelectItem>
            )}
            {operating.choices.map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>
                {choice.label}
                {choice.reputation !== null && (
                  <span className="text-muted-foreground">
                    {' '}
                    · {choice.reputation}
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {operating.missing && (
        <p role="note" className="text-sm text-amber-300 md:text-right">
          The operating settlement is no longer one of the campaign&apos;s
          settlements. Choose another or repair it in Militia corrections.
          {correctionsHref && (
            <>
              {' '}
              <GuardedLink
                href={correctionsHref}
                className="text-primary underline-offset-4 hover:underline"
              >
                Open Militia corrections
              </GuardedLink>
            </>
          )}
        </p>
      )}
    </div>
  );
}

function SlotStatus({ slot }: { slot: Slot }) {
  if (slot.status.kind === 'empty')
    return <span className="text-muted-foreground">Empty</span>;
  if (slot.status.kind === 'ready')
    return (
      <span className="inline-flex items-center gap-1">
        <Check aria-hidden className="size-3.5" />
        Ready
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1">
      <CircleDot aria-hidden className="size-3.5" />
      {slot.status.count} to do
    </span>
  );
}

function SlotTeam({ slot }: { slot: Slot }) {
  if (slot.team?.name)
    return (
      <span className="inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs [overflow-wrap:anywhere]">
        {slot.team.name}
      </span>
    );
  if (slot.team)
    return <span className="text-xs text-amber-300">Missing team</span>;
  if (slot.choice && actionTeamTypes(slot.choice.actionId) !== null)
    return <span className="text-muted-foreground text-xs">No team yet</span>;
  return null;
}

function SlotCard({
  slot,
  board,
  disabled,
}: {
  slot: Slot;
  board: ActivityBoard;
  disabled: boolean;
}) {
  const occupied = slot.choice !== null;
  const selected = board.selectedSlot?.slotId === slot.slotId;
  const beyond = slot.beyondAllowance || slot.overAllowance;
  return (
    <div
      role="group"
      id={activitySlotAnchor(slot.slotId)}
      tabIndex={-1}
      aria-label={`Action Slot ${slot.number}`}
      className="relative flex min-w-0 md:min-w-32 md:flex-1"
    >
      <button
        type="button"
        ref={(node) => board.registerSlot(slot.slotId, node)}
        aria-label={
          occupied
            ? `Action Slot ${slot.number} · ${slot.actionName}`
            : `Choose an action for Action Slot ${slot.number}`
        }
        aria-pressed={occupied ? selected : undefined}
        onClick={() => board.activateSlot(slot.slotId)}
        // Short viewports: the card is two wrapping lines with no height floor
        // so a whole slot fits the scroll column.
        className={cn(
          'focus-visible:ring-ring/50 short:min-h-0 short:flex-row short:flex-wrap short:items-center short:gap-x-3 short:gap-y-0.5 short:p-2 flex min-h-36 w-full min-w-0 touch-manipulation flex-col gap-1.5 rounded-lg border-2 p-2.5 text-left transition-transform outline-none focus-visible:ring-[3px] motion-safe:hover:-translate-y-0.5 motion-reduce:transform-none',
          occupied ? 'bg-card' : 'border-dashed',
          beyond ? 'border-amber-500' : 'border-foreground/25',
          selected && 'border-primary ring-primary/40 ring-2',
          !occupied && disabled && 'opacity-60',
        )}
      >
        <span className="short:basis-full short:justify-start short:gap-x-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs">
          <span className="text-muted-foreground font-mono">
            Slot {slot.number}
          </span>
          <SlotStatus slot={slot} />
        </span>
        {slot.warningCount > 0 && (
          <span className="text-xs text-amber-300">
            {slot.warningCount}{' '}
            {slot.warningCount === 1 ? 'warning' : 'warnings'}
          </span>
        )}
        {slot.strategistBonus && (
          <Badge variant="secondary" className="max-w-full">
            <Sparkles aria-hidden />
            Strategist +2
          </Badge>
        )}
        {occupied ? (
          <>
            <span className="min-w-0 leading-tight font-semibold [overflow-wrap:anywhere]">
              {slot.actionName}
            </span>
            <SlotTeam slot={slot} />
          </>
        ) : (
          <span className="text-muted-foreground short:mt-0 mt-auto text-sm">
            Tap to choose an action
          </span>
        )}
        {beyond && (
          <span className="short:mt-0 mt-auto text-xs text-amber-300">
            Beyond the allowance
          </span>
        )}
      </button>
      {slot.removable && (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`Remove Action Slot ${slot.number}`}
          disabled={disabled}
          onClick={() => board.removeSlot(slot.slotId)}
          className="bg-background absolute -top-2 -right-2 size-8 touch-manipulation rounded-full"
        >
          <X aria-hidden className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

export function ActivitySlotBoard({
  view,
  board,
  disabled,
  correctionsHref,
}: {
  view: ActivityView;
  board: ActivityBoard;
  disabled: boolean;
  correctionsHref?: string;
}) {
  const { allowance } = view;
  const blockedNote =
    allowance.removalBlocked &&
    view.slots.some(
      (slot) => !slot.choice && slot.beyondAllowance && !slot.removable,
    )
      ? removalBlockedNotes[allowance.removalBlocked]
      : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-x-6 gap-y-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-sm [overflow-wrap:anywhere]">
              <span className="font-mono text-base font-semibold">
                {allowance.occupied} of {allowance.actions}
              </span>{' '}
              actions ·{' '}
              <span className="text-muted-foreground">
                {allowanceSource(allowance)}
              </span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => board.addSlot()}
            >
              <Plus aria-hidden />
              Add slot
            </Button>
          </div>
          {allowance.changes.map((change) => (
            <p
              key={change.slotNumber}
              className="text-muted-foreground text-sm"
            >
              From Action Slot {change.slotNumber} the allowance is{' '}
              {change.allowance} after an earlier officer change.
            </p>
          ))}
          {blockedNote && (
            <p className="text-muted-foreground text-sm">{blockedNote}</p>
          )}
        </div>
        <OperatingFrom
          operating={view.operating}
          board={board}
          disabled={disabled}
          correctionsHref={correctionsHref}
        />
      </div>
      <div className="-mx-1 overflow-x-auto px-3 pt-3 pb-2">
        {/* Short viewports stack the slots full width, like the phone grid. */}
        <div className="short:grid-cols-1 not-short:md:flex not-short:md:items-stretch grid grid-cols-2 gap-3 md:gap-2">
          {view.slots.map((slot, index) => {
            const previous = view.slots[index - 1];
            const boundary =
              slot.beyondAllowance &&
              previous !== undefined &&
              !previous.beyondAllowance;
            return (
              <SlotCardWithDivider
                key={slot.slotId}
                slot={slot}
                boundary={boundary}
                board={board}
                disabled={disabled}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// The allowance boundary: a vertical amber rule before the first slot beyond
// it on the one-row board; the phone and short-viewport grids rely on each
// card's own amber border and "Beyond the allowance" text.
function SlotCardWithDivider({
  slot,
  boundary,
  board,
  disabled,
}: {
  slot: Slot;
  boundary: boolean;
  board: ActivityBoard;
  disabled: boolean;
}) {
  return (
    <>
      {boundary && (
        <span
          aria-hidden
          className="not-short:md:block hidden w-0.5 shrink-0 self-stretch rounded bg-amber-500"
        />
      )}
      <SlotCard slot={slot} board={board} disabled={disabled} />
    </>
  );
}
