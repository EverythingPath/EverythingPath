'use client';
import { cn } from '~/lib/utils';
import { fieldLabel } from './sheet-parts';

/** A CRB condition with no numeric Modifiers is not without effect. */
export const rulesOnlyText =
  'No numeric Modifiers. Its rules say what it does.';

/**
 * What a CRB condition does beyond its numbers: its rules as readable
 * text, then, as "Not calculated", every quantity the sheet does not work
 * out, so a player never takes a total for complete. Nothing here is a
 * number the sheet invents.
 */
export function ConditionRules({
  notes,
  unmodeled,
  source,
  className,
}: {
  notes: string[];
  unmodeled: string[];
  /** The rules' source label ("CRB"), shown with the heading. */
  source?: string;
  className?: string;
}) {
  if (notes.length === 0 && unmodeled.length === 0) return null;
  return (
    <div
      className={cn('space-y-1.5 text-xs [overflow-wrap:anywhere]', className)}
    >
      {notes.length > 0 ? (
        <div>
          <p className={fieldLabel}>{source ? `Rules · ${source}` : 'Rules'}</p>
          <ul className="space-y-1">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {unmodeled.length > 0 ? (
        <div>
          <p className={cn(fieldLabel, 'text-amber-300')}>Not calculated</p>
          <ul className="text-muted-foreground list-disc space-y-0.5 pl-4">
            {unmodeled.map((quantity) => (
              <li key={quantity}>{quantity}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
