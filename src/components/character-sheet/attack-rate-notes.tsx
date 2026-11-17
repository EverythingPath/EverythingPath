import { cn } from '~/lib/utils';

/** The resolver's reload and throw-rate notes, as a labelled list; nothing when there are none. */
export function AttackRateNotes({
  notes,
  label,
  className,
}: {
  notes: readonly string[];
  label: string;
  className?: string;
}) {
  if (notes.length === 0) return null;
  return (
    <ul
      aria-label={label}
      className={cn('text-muted-foreground space-y-0.5 text-xs', className)}
    >
      {notes.map((note) => (
        <li key={note} className="[overflow-wrap:anywhere]">
          {note}
        </li>
      ))}
    </ul>
  );
}
