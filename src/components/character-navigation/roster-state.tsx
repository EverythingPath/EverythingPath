import { Check, Minus } from 'lucide-react';

export function RosterState({ isOnRoster }: { isOnRoster: boolean }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
      {isOnRoster ? (
        <Check aria-hidden className="text-foreground size-4" />
      ) : (
        <Minus aria-hidden className="size-4" />
      )}
      {isOnRoster ? 'On roster' : 'Not on roster'}
    </span>
  );
}
