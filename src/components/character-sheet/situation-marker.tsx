import { cn } from '~/lib/utils';

/**
 * The one situational marker (approved variant 3): a tiny sky diamond at a
 * number's corner, absolutely positioned so the number never shifts. A
 * number with a rule that holds only in some Situation earns it; beside
 * text that already says so, it is decoration.
 */
export function SituationMarker({
  className,
  isDecorative = false,
}: {
  className?: string;
  isDecorative?: boolean;
}) {
  return (
    <span
      {...(isDecorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': 'Situational rules available' })}
      className={cn(
        'pointer-events-none absolute size-1.5 rotate-45 bg-sky-300',
        className,
      )}
    />
  );
}
