'use client';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { CharacterSheetSelectionRow } from './character-sheet-selections-view-model';
import { SaveFeedback } from './sheet-parts';
import {
  findRecordedLevel,
  type SelectionControls,
  type SelectionLevelView,
} from './selection-view-types';

type Direction = 'earlier' | 'later';
type OrderedRow = Pick<
  CharacterSheetSelectionRow,
  | 'name'
  | 'entryId'
  | 'gainedAtClassLevel'
  | 'orderPosition'
  | 'orderCount'
  | 'canMoveEarlier'
  | 'canMoveLater'
>;

const shortcuts: Record<Direction, string> = {
  earlier: 'Alt+ArrowUp',
  later: 'Alt+ArrowDown',
};
const shortcutHints: Record<Direction, string> = {
  earlier: 'Earlier (Alt+Up)',
  later: 'Later (Alt+Down)',
};

/**
 * Focus stays with the row through a move: on the button used while it can
 * still move that way, else on the other one. It is settled once the row's
 * place changes or the move fails; a player who moved on to another control
 * meanwhile keeps focus where it is.
 */
function useFocusAfterMove(position: number | null, isFailed: boolean) {
  const buttons = useRef<Record<Direction, HTMLButtonElement | null>>({
    earlier: null,
    later: null,
  });
  const pending = useRef<{ direction: Direction; from: number | null } | null>(
    null,
  );
  useLayoutEffect(() => {
    const move = pending.current;
    if (!move) return;
    const used = buttons.current[move.direction];
    const other =
      buttons.current[move.direction === 'earlier' ? 'later' : 'earlier'];
    const active = document.activeElement;
    const isFocusElsewhere =
      active !== null &&
      active !== document.body &&
      active !== used &&
      active !== other;
    if (isFocusElsewhere) {
      pending.current = null;
      return;
    }
    const target = [used, other].find((button) => button && !button.disabled);
    if (!target) return;
    if (active !== target) target.focus();
    if (position !== move.from || isFailed) pending.current = null;
  }, [position, isFailed]);
  return {
    register: (direction: Direction) => (button: HTMLButtonElement | null) => {
      buttons.current[direction] = button;
    },
    expectMove: (direction: Direction) => {
      pending.current = { direction, from: position };
    },
  };
}

/**
 * A dated Selection's place among the Selections recorded at its Class Level:
 * Earlier and Later as plain buttons (Alt+Up and Alt+Down while one has
 * focus), and its place in words. A direction with no neighbour at that
 * level is disabled. A row without a usable level, or a Grant, shows nothing.
 * The row waits only on its own save; its failure reads beside the buttons
 * and the same button retries.
 */
export function SelectionOrderControls({
  row,
  levels,
  controls,
  showsFeedback = true,
  className,
}: {
  row: OrderedRow;
  levels: readonly SelectionLevelView[];
  controls: SelectionControls;
  /** Off where the row already acknowledges its own saves. */
  showsFeedback?: boolean;
  className?: string;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const status =
    row.entryId === null
      ? { kind: 'idle' as const }
      : controls.statusForEntry(row.entryId);
  const focus = useFocusAfterMove(row.orderPosition, status.kind === 'error');
  const level = findRecordedLevel(levels, row.gainedAtClassLevel);
  if (row.entryId === null || row.orderPosition === null || !level) return null;
  const entryId = row.entryId;
  const isBlocked = status.kind === 'saving' || maintenance.readOnly;
  const canMove: Record<Direction, boolean> = {
    earlier: row.canMoveEarlier && !isBlocked,
    later: row.canMoveLater && !isBlocked,
  };

  function move(direction: Direction) {
    if (!canMove[direction]) return;
    focus.expectMove(direction);
    void controls.move(entryId, direction);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (isBlocked || !event.altKey) return;
    const direction =
      event.key === 'ArrowUp'
        ? 'earlier'
        : event.key === 'ArrowDown'
          ? 'later'
          : null;
    if (!direction || !canMove[direction]) return;
    event.preventDefault();
    move(direction);
  }

  const button = (direction: Direction) => (
    <Button
      ref={focus.register(direction)}
      type="button"
      size="icon"
      variant="ghost"
      className="size-11 md:size-8"
      title={shortcutHints[direction]}
      aria-label={`Move ${row.name} ${direction} at level ${level.position}`}
      aria-keyshortcuts={shortcuts[direction]}
      aria-describedby={reasonId}
      disabled={!canMove[direction]}
      onClick={() => move(direction)}
      onKeyDown={handleKeyDown}
    >
      {direction === 'earlier' ? (
        <ArrowUp aria-hidden className="size-4" />
      ) : (
        <ArrowDown aria-hidden className="size-4" />
      )}
    </Button>
  );

  return (
    <div
      className={cn('flex flex-wrap items-center gap-x-1 gap-y-1', className)}
    >
      {button('earlier')}
      {button('later')}
      <span className="text-muted-foreground mr-1 font-mono text-xs whitespace-nowrap">
        Order {row.orderPosition} of {row.orderCount}
      </span>
      {showsFeedback ? (
        <SaveFeedback
          status={status}
          savedText="Order saved."
          savingText="Saving…"
          shouldHideWhenIdle
        />
      ) : null}
    </div>
  );
}
