'use client';
import { cn } from '~/lib/utils';

/**
 * A Spell's name in a dense row. On the phone it is the button that opens
 * the row's description beneath (the record check stays a separate control,
 * so a tap on the name never records or removes); from tablet width the
 * description sits beside it and the name is plain text.
 */
export function SpellName({
  name,
  panelId,
  isExpanded,
  onToggle,
  className,
}: {
  name: string;
  panelId: string;
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const text = 'font-sans text-base leading-tight [overflow-wrap:anywhere]';
  return (
    <>
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? panelId : undefined}
        onClick={onToggle}
        className={cn('min-h-11 text-left md:hidden', text, className)}
      >
        {name}
      </button>
      <span className={cn('hidden md:inline', text, className)}>{name}</span>
    </>
  );
}
