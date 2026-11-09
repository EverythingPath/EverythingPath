'use client';
import { Button } from '~/components/ui/button';
import type { PersistentRetained } from './types';
import type { PersistentCheck } from './use-persistent-check';

// Recorded check fields this check does not use, each removable on its own so
// nothing is dropped silently.
export function RetainedDetails({
  retained,
  actions,
  disabled,
}: {
  retained: PersistentRetained[];
  actions: PersistentCheck;
  disabled: boolean;
}) {
  const removeButton = 'min-h-11 sm:ml-auto sm:min-h-8';
  return (
    <div className="text-muted-foreground min-w-0 space-y-2 rounded-md border p-3 text-sm">
      <h4 className="text-xs font-medium">
        Also recorded, not used by this check
      </h4>
      <ul className="space-y-1">
        {retained.map((entry) => (
          <li
            key={entry.field}
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
          >
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {entry.label}:{' '}
              <span className="text-foreground">{entry.value}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={removeButton}
              disabled={disabled}
              aria-label={`Remove retained ${entry.label}`}
              onClick={() => void actions.clearRetained(entry.field)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
