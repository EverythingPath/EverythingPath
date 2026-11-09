'use client';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { cn } from '~/lib/utils';

// The retry for a session that never settles: only a new page load starts
// sign-in again.
export function reloadPage() {
  window.location.reload();
}

// One page-local failure card. The shell and its section links stay usable
// around it; the retry only reloads this page's data.
export function FailedLoadCard({
  noun,
  retry,
  className,
  hint,
}: {
  noun: string;
  retry: () => void;
  className?: string;
  /** A sentence after the failure, e.g. "Please try again." */
  hint?: string;
}) {
  const sentence = `${noun} could not be loaded.`;
  return (
    <Card role="alert" className={cn('gap-3 p-4', className)}>
      <p>{hint ? `${sentence} ${hint}` : sentence}</p>
      <div>
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      </div>
    </Card>
  );
}
