import { cn } from '~/lib/utils';
import { fieldLabel } from './sheet-parts';

/**
 * The catalog's guidance for recording a feat or trait, such as what a
 * drawback asks the table to note. It is advice, never a prerequisite, so it
 * reads under its own label.
 */
export function SelectionGuidance({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  if (!text.trim()) return null;
  return (
    <p
      className={cn(
        'text-muted-foreground flex flex-wrap items-baseline gap-x-1.5 text-xs [overflow-wrap:anywhere]',
        className,
      )}
    >
      <span className={fieldLabel}>Guidance</span>
      <span className="min-w-0">{text}</span>
    </p>
  );
}
