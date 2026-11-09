import { cn } from '~/lib/utils';

/** The catalog's description of a feat or trait, beneath its name. */
export function SelectionDescription({
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
        'text-muted-foreground text-xs [overflow-wrap:anywhere]',
        className,
      )}
    >
      {text}
    </p>
  );
}
