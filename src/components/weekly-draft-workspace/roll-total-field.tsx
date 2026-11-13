'use client';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import type { RollSpec } from '~/lib/raw-roll';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { WholeNumberField } from './whole-number-field';
import {
  editableTotal,
  rangeAdvisory,
  recordedRollExplanation,
  rollNotation,
  rollReadFacts,
  totalRoll,
} from './roll-facts';

// The one dice-only total control for every supported roll. It reads the
// recorded total through the shared normalizer and writes a total against the
// rule's expected specification. A blank clears through the owning operation
// supplied by the caller; a total recorded for another specification stays
// untouched and visible until the player types a replacement or clears it
// deliberately.
export function RollTotalField({
  label,
  spec,
  recorded,
  disabled = false,
  required = false,
  onRoll,
  onInvalid,
}: {
  label: string;
  spec: RollSpec;
  recorded: RawRoll | null | undefined;
  disabled?: boolean;
  required?: boolean;
  onRoll: (roll: RawRoll | null) => void;
  onInvalid?: (message: string | null) => void;
}) {
  const facts = rollReadFacts(recorded, spec);
  const value = editableTotal(facts);
  const explanation = recordedRollExplanation(recorded, spec);
  const advisory = rangeAdvisory(facts.normalized, spec);
  // An explicit clear discards any rejected local text with the recorded roll.
  const [generation, setGeneration] = useState(0);
  function clear() {
    onInvalid?.(null);
    setGeneration((current) => current + 1);
    onRoll(null);
  }
  return (
    <div className="min-w-0 space-y-1">
      <WholeNumberField
        key={generation}
        label={label}
        value={value}
        required={required}
        disabled={disabled}
        onInvalid={onInvalid}
        onValue={(total) =>
          onRoll(total === null ? null : totalRoll(total, spec, recorded))
        }
        description={
          <>
            <span>{rollNotation(spec)} · total of the dice only</span>
            {recorded?.provenance.kind === 'generated' && (
              <>
                {' · '}
                <span>Recorded roll.</span>
              </>
            )}
          </>
        }
      />
      {explanation && (
        <p role="note" className="text-sm text-amber-300">
          {explanation}
        </p>
      )}
      {explanation && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={clear}
        >
          Clear {label.toLowerCase()}
        </Button>
      )}
      {advisory && (
        <p role="note" className="text-sm text-amber-300">
          {advisory}
        </p>
      )}
    </div>
  );
}
