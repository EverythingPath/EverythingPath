'use client';
import { Button } from '~/components/ui/button';
import type { EventRetainedField } from './types';

// The recorded occurrence inputs the resolved event does not use, folded
// away with one clear button each. `subject` is the block label, which
// names the buttons for assistive technology.
export function EventRetainedInputs({
  retained,
  subject,
  disabled,
  onClear,
}: {
  retained: EventRetainedField[];
  subject: string;
  disabled: boolean;
  onClear: (field: EventRetainedField['field']) => void;
}) {
  if (retained.length === 0) return null;
  return (
    <details className="min-w-0">
      <summary className="cursor-pointer text-sm font-medium">
        Recorded inputs this event does not use ({retained.length})
      </summary>
      <div className="mt-2 space-y-2">
        {retained.map((entry) => (
          <div
            key={entry.field}
            className="flex flex-wrap items-center gap-x-4 gap-y-2"
          >
            <p className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]">
              {entry.label}: {entry.value}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Clear ${entry.label} from ${subject}`}
              disabled={disabled}
              onClick={() => onClear(entry.field)}
            >
              Clear {entry.label.toLowerCase()}
            </Button>
          </div>
        ))}
      </div>
    </details>
  );
}
