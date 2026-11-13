'use client';
import { Button } from '~/components/ui/button';
import type { NormalizedRoll } from '~/lib/raw-roll';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { rollNotation } from './roll-facts';

// Read-only presentation of a recorded dice total where no rule specification
// applies in the current context (for example a nested roll on an occurrence
// whose event type is not resolved yet). It shows exactly what was recorded,
// zero included, and never guesses a specification; callers supply any
// removal control through the owning operation.
export function RecordedRollTotal({
  label,
  recorded,
  normalized = null,
  disabled = false,
  onClear,
}: {
  label: string;
  recorded: RawRoll;
  normalized?: NormalizedRoll | null;
  disabled?: boolean;
  onClear?: () => void;
}) {
  const recordedNotation = rollNotation({
    count: recorded.diceCount,
    sides: recorded.sides,
  });
  return (
    <div
      role="group"
      aria-label={label}
      className="min-w-0 space-y-2 rounded-md border p-3 text-sm"
    >
      <p>
        <span className="text-muted-foreground text-xs">Recorded total</span>{' '}
        <strong className="font-mono">{recorded.diceTotal}</strong>{' '}
        <span className="text-muted-foreground font-mono text-xs">
          {recordedNotation}
        </span>
      </p>
      {recorded.provenance.kind === 'generated' && (
        <p className="text-muted-foreground text-xs">Recorded roll.</p>
      )}
      {normalized?.status === 'incomplete' && (
        <p role="note" className="text-amber-300">
          This step needs {rollNotation(normalized)}, but the recorded total is
          for {recordedNotation}. Clear it to enter the required roll.
        </p>
      )}
      {normalized?.status === 'complete' &&
        normalized.rangeWarning === 'total' && (
          <p role="note" className="text-amber-300">
            The usual range is {normalized.count}–
            {normalized.count * normalized.sides}. The recorded total is
            retained for the table.
          </p>
        )}
      {onClear && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={onClear}
        >
          Clear {label.toLowerCase()}
        </Button>
      )}
    </div>
  );
}
