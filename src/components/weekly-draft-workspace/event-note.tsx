'use client';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

// A note about a recorded value the event keeps but does not use, or asks
// to repair, with the one action that deals with it. `advisory` notes are
// amber and announced as notes; quiet ones are muted.
export function EventNote({
  children,
  action,
  actionLabel,
  disabled,
  onAction,
  advisory = true,
}: {
  children: ReactNode;
  // Visible button text, and its accessible name when it needs context.
  action: string;
  actionLabel?: string;
  disabled: boolean;
  onAction: () => void;
  advisory?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p
        role={advisory ? 'note' : undefined}
        className={cn(
          'min-w-0 text-sm [overflow-wrap:anywhere]',
          advisory ? 'text-amber-300' : 'text-muted-foreground',
        )}
      >
        {children}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={actionLabel}
        disabled={disabled}
        onClick={onAction}
      >
        {action}
      </Button>
    </div>
  );
}
